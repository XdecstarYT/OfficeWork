/**
 * A small hand-rolled SVG chart kit.
 *
 * Everything here draws into a fixed viewBox and is sized with CSS
 * (`w-full h-auto`), so charts scale with their container without a charting
 * dependency - the app ships no runtime libraries beyond React and Supabase,
 * and a couple of hundred lines of SVG is far cheaper than pulling one in.
 */

const AXIS = "#d6d3d1"; // stone-300
const GRID = "#f5f5f4"; // stone-100
const LABEL = "#a8a29e"; // stone-400

export interface Point {
  label: string;
  value: number;
}

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const scaled = max / magnitude;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatTick(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

export function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-md bg-stone-50 text-sm text-stone-400">
      {message}
    </div>
  );
}

/** Filled line chart - one series over time. */
export function LineChart({
  points,
  color = "#047857",
  valueLabel = "",
  height = 180,
}: {
  points: Point[];
  color?: string;
  valueLabel?: string;
  height?: number;
}) {
  if (points.length === 0) return <EmptyChart message="No data yet." />;

  const w = 620;
  const h = height;
  const pad = { top: 12, right: 12, bottom: 26, left: 38 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const max = niceMax(Math.max(...points.map((p) => p.value)));
  // A single point has no span to divide by; centre it instead.
  const x = (i: number) => (points.length === 1 ? pad.left + plotW / 2 : pad.left + (i / (points.length - 1)) * plotW);
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${pad.top + plotH} L${x(0).toFixed(1)},${pad.top + plotH} Z`;
  const ticks = [0, 0.5, 1].map((f) => max * f);
  // Keep the x-axis readable however many days are in range.
  const labelEvery = Math.ceil(points.length / 7);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={`Line chart of ${valueLabel}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.left} x2={w - pad.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
          <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={LABEL}>
            {formatTick(t)}
          </text>
        </g>
      ))}
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={p.label} cx={x(i)} cy={y(p.value)} r={points.length > 20 ? 1.8 : 3} fill={color}>
          <title>{`${p.label}: ${p.value}${valueLabel ? ` ${valueLabel}` : ""}`}</title>
        </circle>
      ))}
      <line x1={pad.left} x2={w - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke={AXIS} strokeWidth={1} />
      {points.map((p, i) =>
        i % labelEvery === 0 || i === points.length - 1 ? (
          <text key={p.label} x={x(i)} y={h - 8} textAnchor="middle" fontSize={11} fill={LABEL}>
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** Vertical bars - one value per column. */
export function BarChart({
  points,
  color = "#0f766e",
  valueLabel = "",
  height = 180,
  formatValue = (v: number) => String(v),
}: {
  points: Point[];
  color?: string;
  valueLabel?: string;
  height?: number;
  formatValue?: (value: number) => string;
}) {
  if (points.length === 0) return <EmptyChart message="No data yet." />;

  const w = 620;
  const h = height;
  const pad = { top: 12, right: 12, bottom: 26, left: 38 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const max = niceMax(Math.max(...points.map((p) => p.value)));
  const slot = plotW / points.length;
  const barW = Math.max(2, Math.min(28, slot * 0.65));
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;
  const ticks = [0, 0.5, 1].map((f) => max * f);
  const labelEvery = Math.ceil(points.length / 7);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={`Bar chart of ${valueLabel}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.left} x2={w - pad.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
          <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={LABEL}>
            {formatTick(t)}
          </text>
        </g>
      ))}
      {points.map((p, i) => {
        const cx = pad.left + slot * i + slot / 2;
        const barH = Math.max(p.value > 0 ? 1 : 0, pad.top + plotH - y(p.value));
        return (
          <rect key={p.label} x={cx - barW / 2} y={y(p.value)} width={barW} height={barH} rx={2} fill={color}>
            <title>{`${p.label}: ${formatValue(p.value)}${valueLabel ? ` ${valueLabel}` : ""}`}</title>
          </rect>
        );
      })}
      <line x1={pad.left} x2={w - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke={AXIS} strokeWidth={1} />
      {points.map((p, i) =>
        i % labelEvery === 0 || i === points.length - 1 ? (
          <text key={p.label} x={pad.left + slot * i + slot / 2} y={h - 8} textAnchor="middle" fontSize={11} fill={LABEL}>
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** Horizontal bars - good for rankings, where the labels are names. */
export function HBarChart({
  points,
  color = "#4338ca",
  formatValue = (v: number) => String(v),
}: {
  points: Point[];
  color?: string;
  formatValue?: (value: number) => string;
}) {
  if (points.length === 0) return <EmptyChart message="No data yet." />;

  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <ul className="flex flex-col gap-2">
      {points.map((p) => (
        <li key={p.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-stone-600" title={p.label}>
            {p.label}
          </span>
          <span className="h-4 min-w-0 flex-1 overflow-hidden rounded bg-stone-100">
            <span
              className="block h-full rounded"
              style={{ width: `${Math.max(2, (p.value / max) * 100)}%`, backgroundColor: color }}
            />
          </span>
          <span className="w-16 shrink-0 text-right text-xs tabular-nums text-stone-500">
            {formatValue(p.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Donut - a share-of-total breakdown. */
export function DonutChart({
  slices,
  size = 160,
  centerLabel,
  centerSub,
}: {
  slices: { label: string; value: number; color: string }[];
  size?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return <EmptyChart message="Nothing to break down yet." />;

  const r = 60;
  const thickness = 20;
  const circumference = 2 * Math.PI * r;
  const drawn = slices.filter((s) => s.value > 0);
  // Each arc starts where the previous one ended, so offsets are computed up
  // front rather than accumulated inside the render loop.
  const arcs = drawn.map((slice, i) => ({
    slice,
    length: (slice.value / total) * circumference,
    offset: drawn.slice(0, i).reduce((sum, prev) => sum + (prev.value / total) * circumference, 0),
  }));

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 160 160" width={size} height={size} role="img" aria-label="Share breakdown">
        <g transform="translate(80,80) rotate(-90)">
          {arcs.map(({ slice, length, offset }) => (
            <circle
              key={slice.label}
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth={thickness}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
            >
              <title>{`${slice.label}: ${slice.value} (${Math.round((slice.value / total) * 100)}%)`}</title>
            </circle>
          ))}
        </g>
        {centerLabel && (
          <text x={80} y={78} textAnchor="middle" fontSize={22} fontWeight={600} fill="#1c1917">
            {centerLabel}
          </text>
        )}
        {centerSub && (
          <text x={80} y={96} textAnchor="middle" fontSize={11} fill={LABEL}>
            {centerSub}
          </text>
        )}
      </svg>
      <ul className="flex min-w-0 flex-col gap-1 text-xs">
        {drawn.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-stone-600">{s.label}</span>
            <span className="text-stone-400">
              {s.value} · {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
