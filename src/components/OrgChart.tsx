import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface OrgChartProps {
  members: Profile[];
  ownerId: string;
}

/** A simple rank-grouped tree - one row per distinct level, highest first,
 * rather than a real reporting-line chart (nothing in the data model tracks
 * who reports to whom beyond relative level, so grouping by level is the
 * honest representation of "org structure" this game actually has). */
export function OrgChart({ members, ownerId }: OrgChartProps) {
  const levels = [...new Set(members.map((m) => m.level))].sort((a, b) => b - a);

  return (
    <div className="flex flex-col gap-3">
      {levels.map((level) => {
        const atLevel = members.filter((m) => m.level === level);
        return (
          <div key={level} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
              Level {level}
            </span>
            <div className="flex flex-wrap justify-center gap-2">
              {atLevel.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-md border px-3 py-1.5 text-center text-xs ${
                    m.id === ownerId
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-stone-200 bg-white text-stone-700"
                  }`}
                >
                  <div className="font-medium">
                    {m.id === ownerId && "👑 "}
                    {m.display_name}
                  </div>
                  <div className="text-stone-400">{m.job_title}</div>
                </div>
              ))}
            </div>
            {level !== levels[levels.length - 1] && (
              <div className="h-3 w-px bg-stone-200" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}
