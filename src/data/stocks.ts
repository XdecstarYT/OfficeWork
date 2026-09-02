export interface Stock {
  symbol: string;
  name: string;
  sector: string;
  emoji: string;
  basePrice: number;
  /** How wide the day-to-day noise swings are, as a fraction of price. */
  volatility: number;
}

export const STOCKS: Stock[] = [
  { symbol: "NWLG", name: "Northwind Logistics", sector: "Shipping", emoji: "📦", basePrice: 64, volatility: 0.035 },
  { symbol: "PPCO", name: "Paperclip Holdings", sector: "Office Supplies", emoji: "📎", basePrice: 12, volatility: 0.02 },
  { symbol: "INKW", name: "InkWell Print & Toner", sector: "Office Supplies", emoji: "🖨", basePrice: 28, volatility: 0.03 },
  { symbol: "BREW", name: "Daily Grind Coffee Co.", sector: "Food & Beverage", emoji: "☕", basePrice: 41, volatility: 0.025 },
  { symbol: "CLDX", name: "CloudNexus Systems", sector: "Technology", emoji: "☁️", basePrice: 212, volatility: 0.06 },
  { symbol: "BYTZ", name: "Bytezone Software", sector: "Technology", emoji: "💻", basePrice: 158, volatility: 0.055 },
  { symbol: "SPRK", name: "SparkGrid Energy", sector: "Energy", emoji: "⚡", basePrice: 87, volatility: 0.04 },
  { symbol: "GRNF", name: "Greenfield Realty", sector: "Real Estate", emoji: "🏢", basePrice: 133, volatility: 0.025 },
  { symbol: "FTFD", name: "FastForward Delivery", sector: "Shipping", emoji: "🚚", basePrice: 55, volatility: 0.045 },
  { symbol: "MDVL", name: "MediValue Health", sector: "Healthcare", emoji: "🏥", basePrice: 96, volatility: 0.03 },
  { symbol: "SLVL", name: "Silverline Bank", sector: "Finance", emoji: "🏦", basePrice: 74, volatility: 0.02 },
  { symbol: "TRNQ", name: "Tranquil Insurance", sector: "Finance", emoji: "🛡", basePrice: 61, volatility: 0.018 },
  { symbol: "ORBT", name: "Orbital Satcom", sector: "Technology", emoji: "🛰", basePrice: 305, volatility: 0.08 },
  { symbol: "HRVN", name: "Harborview Foods", sector: "Food & Beverage", emoji: "🍞", basePrice: 33, volatility: 0.02 },
  { symbol: "GRNT", name: "Granite Materials", sector: "Industrial", emoji: "🧱", basePrice: 48, volatility: 0.03 },
  { symbol: "PXLW", name: "PixelWorks Media", sector: "Media", emoji: "🎬", basePrice: 22, volatility: 0.07 },
];

export function getStock(symbol: string): Stock | undefined {
  return STOCKS.find((s) => s.symbol === symbol);
}

/** Deterministic 32-bit hash of a string, used to seed the PRNG below. */
function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 - a small, fast, deterministic PRNG. Returns a function that
 * yields values in [0, 1) on each call. */
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A single deterministic pseudo-random value in [-1, 1] for this
 * symbol+day - same for every player, every session, forever. */
function noiseFor(symbol: string, day: number): number {
  const rand = mulberry32(hashString(`${symbol}:${day}`));
  return rand() * 2 - 1;
}

/** The day-of-year for "today" - the shared clock the whole market ticks on,
 * so every player sees the exact same prices without needing a server. */
export function marketDay(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

/** Deterministic price for a stock on a given market day - a slow sine-wave
 * "macro" trend (so a stock visibly has a personality: some drift up over a
 * season, some down) layered with per-day noise scaled by its volatility.
 * No stored history is needed: this is just a pure function of (symbol, day). */
export function priceOnDay(stock: Stock, day: number): number {
  const phase = (hashString(stock.symbol) % 1000) / 1000;
  const period = 40 + (hashString(stock.symbol + "period") % 40); // 40-80 day cycle
  const trendAmplitude = 0.18 + (hashString(stock.symbol + "amp") % 15) / 100; // 18-32%
  const trend = Math.sin((day / period) * Math.PI * 2 + phase * Math.PI * 2) * trendAmplitude;
  const noise = noiseFor(stock.symbol, day) * stock.volatility;
  const price = stock.basePrice * (1 + trend) * (1 + noise);
  return Math.max(0.5, price);
}

export function currentPrice(stock: Stock): number {
  return priceOnDay(stock, marketDay());
}

/** Price history for the last `days` market days (oldest first), for a
 * sparkline. */
export function priceHistory(stock: Stock, days: number): number[] {
  const today = marketDay();
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(priceOnDay(stock, today - i));
  return out;
}

export function dayChangePercent(stock: Stock): number {
  const today = marketDay();
  const todayPrice = priceOnDay(stock, today);
  const yesterdayPrice = priceOnDay(stock, today - 1);
  if (yesterdayPrice <= 0) return 0;
  return ((todayPrice - yesterdayPrice) / yesterdayPrice) * 100;
}
