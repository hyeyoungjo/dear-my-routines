import { faGear } from "@fortawesome/free-solid-svg-icons";

/**
 * Panel 1 of the guide: a stylized SVG mock of the calendar screen. Five column
 * boxes — Shelf / Plan / Act / Reflect / AI — with labelled callouts, plus the
 * timeline that Plan and Act share (aligned faint rows + a centre axis). The
 * Shelf (left) and AI (right) panels are drawn dashed because they toggle on and
 * off. Pure SVG so it themes with CSS vars and scales as one unit (callouts live
 * inside the viewBox). Labels come in as props so the text is i18n'd by the caller.
 */
type Labels = {
  settings: string;
  shelf: string;
  plan: string;
  act: string;
  reflect: string;
  ai: string;
  timeline: string;
};

const [GEAR_W, GEAR_H, , , GEAR_RAW] = faGear.icon;
const GEAR_PATH = typeof GEAR_RAW === "string" ? GEAR_RAW : GEAR_RAW[0];

/** The FontAwesome gear glyph, centred at (cx, cy) at the given pixel size. */
function Gear({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const s = size / GEAR_H;
  return (
    <g transform={`translate(${cx - (GEAR_W * s) / 2} ${cy - (GEAR_H * s) / 2}) scale(${s})`}>
      <path d={GEAR_PATH} fill="var(--muted)" />
    </g>
  );
}

/** A rounded column box. `dashed` marks a toggleable rail (Shelf / AI). */
function Column({ x, w, dashed }: { x: number; w: number; dashed?: boolean }) {
  return (
    <rect
      x={x}
      y={98}
      width={w}
      height={160}
      rx={6}
      fill="var(--background)"
      stroke="var(--border)"
      strokeWidth={1}
      strokeDasharray={dashed ? "4 3" : undefined}
    />
  );
}

/** An accent label box + a connector line to a target dot on the mock. */
function Callout({
  label,
  x,
  y,
  w,
  tx,
  ty,
}: {
  label: string;
  x: number;
  y: number;
  w: number;
  tx: number;
  ty: number;
}) {
  const h = 24;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g>
      <line x1={cx} y1={cy} x2={tx} y2={ty} stroke="var(--accent)" strokeWidth={1.5} />
      <circle cx={tx} cy={ty} r={3} fill="var(--accent)" />
      <rect x={x} y={y} width={w} height={h} rx={6} fill="var(--accent)" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} fill="#fff">
        {label}
      </text>
    </g>
  );
}

/** A tinted plan/action block on the mock. */
function Block({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <rect x={x} y={y} width={w} height={h} rx={3} fill="var(--accent)" fillOpacity={0.18} stroke="var(--accent)" strokeOpacity={0.4} />
  );
}

/** A faint text line (Reflect journal / AI read-out). */
function TextLine({ x, y, w }: { x: number; y: number; w: number }) {
  return <rect x={x} y={y} width={w} height={5} rx={2} fill="var(--muted)" fillOpacity={0.3} />;
}

export function InterfaceDiagram({ labels }: { labels: Labels }) {
  // Shared time rows: the same y in Plan and Act is the same clock time.
  const gridRows = [118, 146, 174, 202, 230];
  return (
    <svg
      viewBox="0 0 580 340"
      className="h-auto w-full"
      role="img"
      aria-label={`${labels.settings}, ${labels.shelf}, ${labels.plan}, ${labels.act}, ${labels.reflect}, ${labels.ai}, ${labels.timeline}`}
    >
      {/* Mock app window */}
      <rect x={150} y={66} width={340} height={200} rx={10} fill="var(--panel)" stroke="var(--border)" strokeWidth={1.5} />
      {/* Nav strip + the settings gear */}
      <line x1={150} y1={90} x2={490} y2={90} stroke="var(--border)" strokeWidth={1} />
      <Gear cx={455} cy={78} size={15} />

      {/* Column boxes — Shelf (dashed) | Plan | Act | Reflect | AI (dashed) */}
      <Column x={158} w={36} dashed />
      <Column x={200} w={64} />
      <Column x={278} w={64} />
      <Column x={348} w={64} />
      <Column x={418} w={50} dashed />

      {/* Shelf chips */}
      <rect x={163} y={106} width={26} height={9} rx={2} fill="var(--accent)" fillOpacity={0.25} />
      <rect x={163} y={119} width={26} height={9} rx={2} fill="var(--accent)" fillOpacity={0.25} />

      {/* Shared timeline: aligned faint rows in Plan + Act, centre axis in the gap */}
      {gridRows.map((y) => (
        <g key={y}>
          <line x1={200} y1={y} x2={264} y2={y} stroke="var(--muted)" strokeOpacity={0.16} strokeWidth={1} />
          <line x1={278} y1={y} x2={342} y2={y} stroke="var(--muted)" strokeOpacity={0.16} strokeWidth={1} />
        </g>
      ))}
      <line x1={271} y1={98} x2={271} y2={258} stroke="var(--border)" strokeWidth={1} />

      {/* Plan + Act blocks (aligned heights → same time on the shared timeline) */}
      <Block x={206} y={104} w={52} h={22} />
      <Block x={206} y={140} w={52} h={34} />
      <Block x={284} y={104} w={52} h={22} />
      <Block x={284} y={140} w={52} h={34} />

      {/* Reflect column — journal text lines */}
      <TextLine x={354} y={106} w={52} />
      <TextLine x={354} y={116} w={52} />
      <TextLine x={354} y={126} w={36} />
      <TextLine x={354} y={146} w={52} />
      <TextLine x={354} y={156} w={40} />

      {/* AI panel — an analyze button + a short read-out */}
      <rect x={424} y={106} width={38} height={12} rx={3} fill="var(--accent)" fillOpacity={0.3} />
      <TextLine x={424} y={126} w={38} />
      <TextLine x={424} y={134} w={30} />
      <TextLine x={424} y={146} w={38} />

      {/* Callouts */}
      <Callout label={labels.timeline} x={180} y={14} w={140} tx={271} ty={100} />
      <Callout label={labels.settings} x={384} y={14} w={90} tx={455} ty={78} />
      <Callout label={labels.shelf} x={16} y={150} w={80} tx={176} ty={178} />
      <Callout label={labels.ai} x={484} y={150} w={64} tx={443} ty={178} />
      <Callout label={labels.plan} x={200} y={300} w={64} tx={232} ty={258} />
      <Callout label={labels.act} x={278} y={300} w={64} tx={310} ty={258} />
      <Callout label={labels.reflect} x={348} y={300} w={64} tx={380} ty={258} />
    </svg>
  );
}
