/**
 * Schematic front view of the heart's four chambers, with a "?" marker on
 * one of them. Used by identification questions (image key "heart:<chamber>").
 * Front view: the patient's right side is on the viewer's left.
 */
type Chamber = "ra" | "rv" | "la" | "lv";

const markers: Record<Chamber, { x: number; y: number }> = {
  ra: { x: 72, y: 92 },
  rv: { x: 82, y: 150 },
  la: { x: 148, y: 92 },
  lv: { x: 138, y: 150 },
};

export function parseDiagram(image: string | null): Chamber | null {
  const [kind, part] = image?.split(":") ?? [];
  return kind === "heart" && part && part in markers ? (part as Chamber) : null;
}

export default function HeartDiagram({ chamber }: { chamber: Chamber }) {
  const m = markers[chamber];
  return (
    <figure className="heart-diagram">
      <svg viewBox="0 0 220 220" role="img" aria-label="Diagram of the heart with one chamber marked by a question mark">
        <defs>
          <clipPath id="heart-body">
            <path d="M44 60 H176 Q198 60 198 84 V120 Q198 172 110 208 Q22 172 22 120 V84 Q22 60 44 60 Z" />
          </clipPath>
        </defs>

        {/* great vessels */}
        <rect x="52" y="14" width="24" height="56" rx="10" fill="#8aa9dd" />
        <path d="M116 64 V34 Q116 18 136 18 H156 Q172 18 172 34 V52" fill="none" stroke="#e58a8a" strokeWidth="18" strokeLinecap="round" />
        <rect x="92" y="34" width="20" height="34" rx="9" fill="#9cb6e3" />

        {/* chambers */}
        <g clipPath="url(#heart-body)">
          <rect x="0" y="0" width="110" height="112" fill="#a9c2ec" />
          <rect x="0" y="112" width="110" height="120" fill="#86a6dd" />
          <rect x="110" y="0" width="120" height="112" fill="#f2b0b0" />
          <rect x="110" y="112" width="120" height="120" fill="#e88a8a" />
          <path d="M110 60 V220" stroke="#fff" strokeWidth="5" />
          <path d="M0 112 H220" stroke="#fff" strokeWidth="5" />
        </g>
        <path
          d="M44 60 H176 Q198 60 198 84 V120 Q198 172 110 208 Q22 172 22 120 V84 Q22 60 44 60 Z"
          fill="none"
          stroke="#5b6f9e"
          strokeWidth="2.5"
        />

        {/* marker */}
        <circle cx={m.x} cy={m.y} r="16" fill="#4a86d4" opacity="0.25" className="heart-pulse" />
        <circle cx={m.x} cy={m.y} r="12" fill="#fff" stroke="#3a72c0" strokeWidth="2.5" />
        <text x={m.x} y={m.y + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill="#3a72c0">
          ?
        </text>
      </svg>
      <figcaption>Front view · patient's right is on your left</figcaption>
    </figure>
  );
}
