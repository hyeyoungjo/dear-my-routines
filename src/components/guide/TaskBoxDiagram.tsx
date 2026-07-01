import {
  faMaximize,
  faXmark,
  faTrashCan,
  faBoxArchive,
  faCircleArrowRight,
  faUpDownLeftRight,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

/**
 * Panel 3 of the guide: a task box (a wide block) with callouts for what you can
 * do to it — drag to move (a move glyph on the block), open its details (⤢),
 * shelve it (box), continue it later (arrow → today/tomorrow/a date) — and the
 * detail window the ⤢
 * opens (dashed link). Each label sits next to its control with a short
 * connector (top for the top-row buttons, bottom for the bottom ones) so the
 * lines don't cross. Pure SVG, themed with CSS vars; text is i18n'd by the caller.
 */
type Labels = {
  drag: string;
  details: string;
  detailWindow: string;
  shelve: string;
  continueLater: string;
};

/** A FontAwesome glyph centred at (cx, cy) at the given pixel size. */
function Glyph({
  icon,
  cx,
  cy,
  size,
  fill,
  opacity,
}: {
  icon: IconDefinition;
  cx: number;
  cy: number;
  size: number;
  fill: string;
  opacity?: number;
}) {
  const [w, h, , , raw] = icon.icon;
  const path = typeof raw === "string" ? raw : raw[0];
  const s = size / h;
  return (
    <g transform={`translate(${cx - (w * s) / 2} ${cy - (h * s) / 2}) scale(${s})`}>
      <path d={path} fill={fill} fillOpacity={opacity} />
    </g>
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

/** A faint text line (title / detail row). */
function Line({ x, y, w, o = 0.35 }: { x: number; y: number; w: number; o?: number }) {
  return <rect x={x} y={y} width={w} height={6} rx={2} fill="var(--muted)" fillOpacity={o} />;
}

export function TaskBoxDiagram({ labels }: { labels: Labels }) {
  return (
    <svg viewBox="0 0 600 300" className="h-auto w-full" role="img" aria-label={labels.drag}>
      {/* The detail window the ⤢ opens */}
      <rect x={440} y={96} width={150} height={124} rx={8} fill="var(--panel)" stroke="var(--border)" strokeWidth={1.5} />
      <Line x={454} y={110} w={84} o={0.5} />
      <Glyph icon={faXmark} cx={576} cy={113} size={9} fill="var(--muted)" />
      <Line x={454} y={132} w={34} o={0.3} />
      <Line x={498} y={132} w={54} o={0.3} />
      <Line x={454} y={150} w={34} o={0.3} />
      <Line x={498} y={150} w={44} o={0.3} />
      <Line x={454} y={168} w={34} o={0.3} />
      <Line x={498} y={168} w={50} o={0.3} />

      {/* Dashed link: ⤢ opens the detail window */}
      <line x1={360} y1={92} x2={452} y2={110} stroke="var(--accent)" strokeWidth={1.3} strokeDasharray="3 2.5" />

      {/* The task box — a wide block */}
      <rect x={90} y={70} width={300} height={150} rx={8} fill="var(--accent)" fillOpacity={0.15} stroke="var(--accent)" strokeOpacity={0.5} strokeWidth={1.5} />
      <circle cx={108} cy={90} r={5} fill="var(--accent)" />
      <Line x={124} y={86} w={190} o={0.4} />
      <Line x={124} y={98} w={130} o={0.4} />
      {/* Drag affordance: a move glyph in the middle of the block */}
      <Glyph icon={faUpDownLeftRight} cx={240} cy={152} size={30} fill="var(--accent)" opacity={0.4} />
      <Glyph icon={faMaximize} cx={352} cy={90} size={13} fill="var(--muted)" />
      <Glyph icon={faTrashCan} cx={372} cy={90} size={13} fill="var(--muted)" />
      <Glyph icon={faBoxArchive} cx={110} cy={202} size={14} fill="var(--muted)" />
      <Glyph icon={faCircleArrowRight} cx={372} cy={202} size={15} fill="var(--muted)" />

      {/* Callouts — each next to its control, short connectors, no crossing */}
      <Callout label={labels.details} x={300} y={16} w={90} tx={352} ty={90} />
      <Callout label={labels.detailWindow} x={452} y={16} w={130} tx={500} ty={96} />
      <Callout label={labels.drag} x={16} y={140} w={110} tx={240} ty={152} />
      <Callout label={labels.shelve} x={64} y={256} w={90} tx={110} ty={202} />
      <Callout label={labels.continueLater} x={300} y={256} w={150} tx={372} ty={202} />
    </svg>
  );
}
