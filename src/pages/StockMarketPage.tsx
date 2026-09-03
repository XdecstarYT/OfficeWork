import { useCallback, useEffect, useMemo, useState } from "react";
import {
  STOCKS,
  currentPrice,
  dayChangePercent,
  priceHistory,
  type Stock,
} from "../data/stocks";
import {
  fetchHoldings,
  fetchRecentTransactions,
  buyStock,
  sellStock,
  type StockHoldingRow,
  type StockTransactionRow,
} from "../lib/stocks";
import { fetchCompanyMembers } from "../lib/company";
import { relativeTime } from "../lib/time";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/database";
import { formatMoney } from "../lib/format";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];

interface StockMarketPageProps {
  profile: Profile;
  company: Company | null;
  onProfileChanged: () => void;
}

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const width = 100;
  const height = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-7 w-24 shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "#059669" : "#dc2626"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StockMarketPage({ profile, company, onProfileChanged }: StockMarketPageProps) {
  const [holdings, setHoldings] = useState<StockHoldingRow[]>([]);
  const [transactions, setTransactions] = useState<StockTransactionRow[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [sortMode, setSortMode] = useState<"name" | "price" | "change" | "held">("name");
  const [tradeStock, setTradeStock] = useState<{ stock: Stock; side: "buy" | "sell" } | null>(null);
  const [tradeShares, setTradeShares] = useState(1);
  const [trading, setTrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const companyId = profile.company_id;

  const load = useCallback(async () => {
    setLoading(true);
    const [h, m] = await Promise.all([
      fetchHoldings(profile.id),
      companyId ? fetchCompanyMembers(companyId) : Promise.resolve([]),
    ]);
    setHoldings(h);
    setMembers(m);
    if (companyId) setTransactions(await fetchRecentTransactions(companyId));
    setLoading(false);
  }, [profile.id, companyId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`stocks-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock_holdings", filter: `member_id=eq.${profile.id}` },
        () => load(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_transactions" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.id, load]);

  const sectors = useMemo(() => [...new Set(STOCKS.map((s) => s.sector))].sort(), []);

  const holdingFor = (symbol: string) => holdings.find((h) => h.symbol === symbol);

  const visibleStocks = STOCKS.filter((s) => sectorFilter === "all" || s.sector === sectorFilter)
    .filter((s) => {
      const q = query.trim().toLowerCase();
      return !q || s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q);
    })
    .slice()
    .sort((a, b) => {
      if (sortMode === "price") return currentPrice(b) - currentPrice(a);
      if (sortMode === "change") return dayChangePercent(b) - dayChangePercent(a);
      if (sortMode === "held") return Number(!!holdingFor(b.symbol)) - Number(!!holdingFor(a.symbol));
      return a.name.localeCompare(b.name);
    });

  const portfolio = holdings.map((h) => {
    const stock = STOCKS.find((s) => s.symbol === h.symbol);
    const price = stock ? currentPrice(stock) : 0;
    const value = h.shares * price;
    const cost = h.shares * h.avg_cost;
    return { holding: h, stock, price, value, cost, gain: value - cost };
  });
  const portfolioValue = portfolio.reduce((sum, p) => sum + p.value, 0);
  const portfolioCost = portfolio.reduce((sum, p) => sum + p.cost, 0);
  const portfolioGain = portfolioValue - portfolioCost;
  const portfolioGainPercent = portfolioCost > 0 ? (portfolioGain / portfolioCost) * 100 : 0;

  function openTrade(stock: Stock, side: "buy" | "sell") {
    setTradeStock({ stock, side });
    setTradeShares(1);
    setError(null);
  }

  async function handleConfirmTrade() {
    if (!tradeStock) return;
    setTrading(true);
    setError(null);
    try {
      const price = currentPrice(tradeStock.stock);
      if (tradeStock.side === "buy") {
        await buyStock({
          memberId: profile.id,
          companyId,
          symbol: tradeStock.stock.symbol,
          shares: tradeShares,
          price,
          currentMoney: profile.money,
        });
        setStatusMessage(`Bought ${tradeShares} ${tradeStock.stock.symbol} @ $${price.toFixed(2)}.`);
      } else {
        await sellStock({
          memberId: profile.id,
          companyId,
          symbol: tradeStock.stock.symbol,
          shares: tradeShares,
          price,
        });
        setStatusMessage(`Sold ${tradeShares} ${tradeStock.stock.symbol} @ $${price.toFixed(2)}.`);
      }
      setTradeStock(null);
      onProfileChanged();
      load();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That trade didn't go through.");
    } finally {
      setTrading(false);
    }
  }

  function nameFor(memberId: string): string {
    if (memberId === profile.id) return "You";
    return members.find((m) => m.id === memberId)?.display_name ?? "A coworker";
  }

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Loading the market…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div>
          <h1 className="text-lg font-semibold text-stone-900">📈 Stock Market</h1>
          <p className="text-sm text-stone-500">
            A shared fictional ticker — prices move once per real day for everyone.
            {company && ` Trading as ${company.name}, Day ${company.current_day}.`}
          </p>
        </div>

        {statusMessage && (
          <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{statusMessage}</div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <p className="text-xs text-stone-400">💵 Cash</p>
            <p className="mt-1 text-lg font-semibold text-stone-900">{formatMoney(profile.money)}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <p className="text-xs text-stone-400">📊 Portfolio Value</p>
            <p className="mt-1 text-lg font-semibold text-stone-900">${portfolioValue.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <p className="text-xs text-stone-400">Net Worth</p>
            <p className="mt-1 text-lg font-semibold text-stone-900">${(profile.money + portfolioValue).toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <p className="text-xs text-stone-400">Unrealized Gain</p>
            <p className={`mt-1 text-lg font-semibold ${portfolioGain >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {portfolioGain >= 0 ? "+" : ""}${portfolioGain.toFixed(2)}{" "}
              <span className="text-xs font-normal">
                ({portfolioGain >= 0 ? "+" : ""}
                {portfolioGainPercent.toFixed(1)}%)
              </span>
            </p>
          </div>
        </div>

        {portfolio.length > 0 && (
          <section className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">💼 My Holdings</h2>
            <div className="flex flex-col gap-1.5">
              {portfolio.map((p) => (
                <div
                  key={p.holding.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-100 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-stone-800">
                    {p.stock?.emoji} {p.holding.symbol} · {p.holding.shares} sh @ avg ${p.holding.avg_cost.toFixed(2)}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-stone-600">${p.value.toFixed(2)}</span>
                    <span className={p.gain >= 0 ? "text-emerald-700" : "text-red-600"}>
                      {p.gain >= 0 ? "+" : ""}${p.gain.toFixed(2)}
                    </span>
                    {p.stock && (
                      <button
                        type="button"
                        onClick={() => openTrade(p.stock!, "sell")}
                        className="rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100"
                      >
                        Sell
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stocks…"
            className="min-w-0 flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">All Sectors</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
            className="rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="name">Sort: Name</option>
            <option value="price">Sort: Price</option>
            <option value="change">Sort: Today's Change</option>
            <option value="held">Sort: Held First</option>
          </select>
        </div>

        <section className="flex flex-col gap-2">
          {visibleStocks.map((stock) => {
            const price = currentPrice(stock);
            const change = dayChangePercent(stock);
            const history = priceHistory(stock, 14);
            const held = holdingFor(stock.symbol);
            return (
              <div
                key={stock.symbol}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white p-3"
              >
                <span className="text-xl">{stock.emoji}</span>
                <div className="min-w-[10rem] flex-1">
                  <p className="text-sm font-semibold text-stone-900">
                    {stock.symbol} <span className="font-normal text-stone-500">{stock.name}</span>
                    {held && (
                      <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        Held
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-stone-400">{stock.sector}</p>
                </div>
                <Sparkline values={history} positive={change >= 0} />
                <div className="w-24 shrink-0 text-right">
                  <p className="text-sm font-semibold text-stone-900">${price.toFixed(2)}</p>
                  <p className={`text-xs font-medium ${change >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openTrade(stock, "buy")}
                  className="shrink-0 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
                >
                  Buy
                </button>
              </div>
            );
          })}
          {visibleStocks.length === 0 && (
            <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-400">
              No stocks match that search/filter.
            </p>
          )}
        </section>

        {transactions.length > 0 && (
          <section className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">🔔 Trading Floor</h2>
            <div className="flex flex-col gap-1">
              {transactions.map((t) => (
                <p key={t.id} className="text-xs text-stone-500">
                  <span className="font-medium text-stone-800">{nameFor(t.member_id)}</span>{" "}
                  {t.side === "buy" ? "bought" : "sold"} {t.shares} {t.symbol} @ ${t.price.toFixed(2)} ·{" "}
                  {relativeTime(t.created_at)}
                </p>
              ))}
            </div>
          </section>
        )}
      </div>

      {tradeStock && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setTradeStock(null)}
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-stone-900">
              {tradeStock.side === "buy" ? "Buy" : "Sell"} {tradeStock.stock.emoji} {tradeStock.stock.symbol}
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Current price: ${currentPrice(tradeStock.stock).toFixed(2)}
              {tradeStock.side === "sell" && holdingFor(tradeStock.stock.symbol) && (
                <> · You own {holdingFor(tradeStock.stock.symbol)!.shares} shares</>
              )}
            </p>
            <label className="mt-3 block text-xs font-medium text-stone-500">Shares</label>
            <input
              type="number"
              min={1}
              max={tradeStock.side === "sell" ? holdingFor(tradeStock.stock.symbol)?.shares ?? 1 : undefined}
              value={tradeShares}
              onChange={(e) => setTradeShares(Math.max(1, Number(e.target.value)))}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="mt-2 text-sm text-stone-600">
              Total: <strong>${(tradeShares * currentPrice(tradeStock.stock)).toFixed(2)}</strong>
            </p>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTradeStock(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmTrade}
                disabled={trading}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  tradeStock.side === "buy" ? "bg-emerald-700 hover:bg-emerald-800" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {trading ? "Placing order…" : tradeStock.side === "buy" ? "Confirm Buy" : "Confirm Sell"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
