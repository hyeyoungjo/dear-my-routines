import { faGear } from "@fortawesome/free-solid-svg-icons";

/**
 * Panel 4 of the guide: a mock of Settings → AI, with callouts for the parts you
 * can set — turn the review on, pick a model, add a custom prompt (the star),
 * and set the history window. The built-in prompt is explained in the caption
 * above the diagram. Pure SVG, themed with CSS vars; text is i18n'd by the caller.
 */
type Labels = {
  enable: string;
  model: string;
  customPrompt: string;
  history: string;
};

const [GEAR_W, GEAR_H, , , GEAR_RAW] = faGear.icon;
const GEAR_PATH = typeof GEAR_RAW === "string" ? GEAR_RAW : GEAR_RAW[0];

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

/** A faint setting-label line. */
function Line({ x, y, w, o = 0.4 }: { x: number; y: number; w: number; o?: number }) {
  return <rect x={x} y={y} width={w} height={6} rx={2} fill="var(--muted)" fillOpacity={o} />;
}

export function AiSettingsDiagram({ labels }: { labels: Labels }) {
  const s = 13 / GEAR_H;
  return (
    <svg viewBox="0 0 560 290" className="h-auto w-full" role="img" aria-label={labels.customPrompt}>
      {/* Settings panel */}
      <rect x={64} y={34} width={250} height={224} rx={10} fill="var(--panel)" stroke="var(--border)" strokeWidth={1.5} />
      {/* Header: gear + title */}
      <g transform={`translate(${84 - (GEAR_W * s) / 2} ${56 - (GEAR_H * s) / 2}) scale(${s})`}>
        <path d={GEAR_PATH} fill="var(--muted)" />
      </g>
      <Line x={100} y={52} w={64} o={0.5} />
      <line x1={64} y1={74} x2={314} y2={74} stroke="var(--border)" strokeWidth={1} />

      {/* Row 1 — AI toggle (on) */}
      <Line x={84} y={91} w={72} />
      <rect x={272} y={85} width={30} height={14} rx={7} fill="var(--accent)" />
      <circle cx={294} cy={92} r={5} fill="#fff" />

      {/* Row 2 — model dropdown */}
      <Line x={84} y={121} w={54} />
      <rect x={248} y={114} width={56} height={16} rx={4} fill="var(--background)" stroke="var(--border)" strokeWidth={1} />
      <path d="M 292 120 L 297 120 L 294.5 124 Z" fill="var(--muted)" />

      {/* Row 3 — custom prompt (review style) textarea */}
      <Line x={84} y={151} w={74} />
      <rect x={84} y={161} width={220} height={46} rx={4} fill="var(--background)" stroke="var(--border)" strokeWidth={1} />
      <Line x={94} y={171} w={132} o={0.25} />
      <Line x={94} y={182} w={98} o={0.25} />

      {/* Row 4 — history window */}
      <Line x={84} y={226} w={58} />
      <rect x={270} y={219} width={34} height={16} rx={4} fill="var(--background)" stroke="var(--border)" strokeWidth={1} />

      {/* Callouts */}
      <Callout label={labels.enable} x={364} y={78} w={100} tx={302} ty={92} />
      <Callout label={labels.model} x={364} y={114} w={100} tx={304} ty={122} />
      <Callout label={labels.customPrompt} x={364} y={172} w={172} tx={304} ty={184} />
      <Callout label={labels.history} x={364} y={220} w={110} tx={304} ty={227} />
    </svg>
  );
}
