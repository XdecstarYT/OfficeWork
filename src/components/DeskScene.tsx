import {
  COSMETIC_BY_ID,
  DEFAULT_EQUIPPED,
  floorColor,
  wallColor,
  type CosmeticSlot,
} from "../data/cosmetics";

export interface DeskLook {
  equipped: Partial<Record<CosmeticSlot, string>>;
  wall: string;
  floor: string;
}

/** Where each emoji item sits in the 320x200 room, and how big it draws. */
const PLACEMENT: Record<Exclude<CosmeticSlot, "desk" | "rug">, { x: number; y: number; size: number }> = {
  poster: { x: 62, y: 52, size: 34 },
  monitor: { x: 168, y: 108, size: 30 },
  mug: { x: 128, y: 112, size: 15 },
  lamp: { x: 208, y: 108, size: 20 },
  chair: { x: 250, y: 152, size: 32 },
  plant: { x: 32, y: 148, size: 34 },
  pet: { x: 92, y: 178, size: 24 },
};

function itemFor(look: DeskLook, slot: CosmeticSlot) {
  return COSMETIC_BY_ID.get(look.equipped[slot] ?? DEFAULT_EQUIPPED[slot]);
}

/**
 * The office itself. Furniture with a colour (desk, rug) is drawn as real
 * shapes so the room reads as a room; everything else is an emoji placed on
 * top, which keeps the catalog cheap to extend - a new item is one entry in
 * src/data/cosmetics.ts and nothing else.
 */
export function DeskScene({ look, className }: { look: DeskLook; className?: string }) {
  const desk = itemFor(look, "desk");
  const rug = itemFor(look, "rug");
  const wall = wallColor(look.wall);
  const floor = floorColor(look.floor);
  const isCheckerFloor = look.floor === "checker";

  return (
    <svg
      viewBox="0 0 320 200"
      className={className ?? "h-auto w-full"}
      role="img"
      aria-label="Your office"
    >
      <defs>
        <pattern id="deskCheck" width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill="#e7e5e4" />
          <rect width="10" height="10" fill="#c8c5c2" />
          <rect x="10" y="10" width="10" height="10" fill="#c8c5c2" />
        </pattern>
      </defs>

      <rect x="0" y="0" width="320" height="128" fill={wall} />
      <rect x="0" y="128" width="320" height="72" fill={isCheckerFloor ? "url(#deskCheck)" : floor} />
      <rect x="0" y="124" width="320" height="5" fill="#00000018" />

      {rug?.color && <ellipse cx="150" cy="172" rx="96" ry="22" fill={rug.color} opacity={0.85} />}

      {/* Desk: a top with two legs, tinted by the equipped desk. */}
      {desk?.color && (
        <g>
          <rect x="96" y="126" width="132" height="9" rx="3" fill={desk.color} />
          <rect x="104" y="135" width="8" height="34" fill={desk.color} opacity={0.8} />
          <rect x="212" y="135" width="8" height="34" fill={desk.color} opacity={0.8} />
          <rect x="96" y="126" width="132" height="3" rx="1.5" fill="#ffffff" opacity={0.25} />
        </g>
      )}

      {(Object.keys(PLACEMENT) as (keyof typeof PLACEMENT)[]).map((slot) => {
        const item = itemFor(look, slot);
        if (!item?.emoji) return null;
        const { x, y, size } = PLACEMENT[slot];
        return (
          <text key={slot} x={x} y={y} fontSize={size} textAnchor="middle" dominantBaseline="middle">
            {item.emoji}
            <title>{item.name}</title>
          </text>
        );
      })}
    </svg>
  );
}
