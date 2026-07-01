import {
  faFolder,
  faCalendarDay,
  faPersonRunning,
  faPenToSquare,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

/**
 * Panel 2 of the guide: the basic flow as four connected steps —
 * Project → Plan → Act → Reflect. Project is optional (drawn dashed with an
 * "optional" tag and reached by a dashed arrow) since the app works without it.
 * Pure SVG, themed with CSS vars, scales as one unit; text is i18n'd by caller.
 */
type Step = { label: string; desc: string };
type Labels = {
  project: Step;
  plan: Step;
  act: Step;
  reflect: Step;
  optional: string;
};

/** A FontAwesome glyph centred at (cx, cy) at the given pixel size. */
function Glyph({
  icon,
  cx,
  cy,
  size,
  fill,
}: {
  icon: IconDefinition;
  cx: number;
  cy: number;
  size: number;
  fill: string;
}) {
  const [w, h, , , raw] = icon.icon;
  const path = typeof raw === "string" ? raw : raw[0];
  const s = size / h;
  return (
    <g transform={`translate(${cx - (w * s) / 2} ${cy - (h * s) / 2}) scale(${s})`}>
      <path d={path} fill={fill} />
    </g>
  );
}

/** One flow step: a rounded card with an icon, label and short description.
 *  `optionalLabel` marks the step as skippable (dashed border + a tag). */
function Node({
  x,
  icon,
  step,
  optionalLabel,
}: {
  x: number;
  icon: IconDefinition;
  step: Step;
  optionalLabel?: string;
}) {
  const cx = x + 58;
  return (
    <g>
      <rect
        x={x}
        y={30}
        width={116}
        height={90}
        rx={10}
        fill="var(--panel)"
        stroke="var(--border)"
        strokeWidth={1.5}
        strokeDasharray={optionalLabel ? "5 4" : undefined}
      />
      {optionalLabel && (
        <>
          <rect x={cx - 30} y={14} width={60} height={17} rx={8.5} fill="var(--panel)" stroke="var(--border)" strokeWidth={1} />
          <text x={cx} y={23} textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={600} fill="var(--muted)">
            {optionalLabel}
          </text>
        </>
      )}
      <Glyph icon={icon} cx={cx} cy={60} size={22} fill="var(--accent)" />
      <text x={cx} y={92} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--foreground)">
        {step.label}
      </text>
      <text x={cx} y={107} textAnchor="middle" fontSize={9.5} fill="var(--muted)">
        {step.desc}
      </text>
    </g>
  );
}

/** A small accent arrow pointing right, centred at cx. Dashed = optional link. */
function Arrow({ cx, dashed }: { cx: number; dashed?: boolean }) {
  return (
    <g>
      <line
        x1={cx - 9}
        y1={75}
        x2={cx + 4}
        y2={75}
        stroke="var(--accent)"
        strokeWidth={2}
        strokeDasharray={dashed ? "3 2.5" : undefined}
      />
      <path d={`M ${cx + 3} 71 L ${cx + 9} 75 L ${cx + 3} 79 Z`} fill="var(--accent)" />
    </g>
  );
}

export function FlowDiagram({ labels }: { labels: Labels }) {
  const xs = [14, 154, 294, 434];
  return (
    <svg
      viewBox="0 0 560 140"
      className="h-auto w-full"
      role="img"
      aria-label={`${labels.project.label} → ${labels.plan.label} → ${labels.act.label} → ${labels.reflect.label}`}
    >
      <Arrow cx={142} dashed />
      <Arrow cx={282} />
      <Arrow cx={422} />
      <Node x={xs[0]} icon={faFolder} step={labels.project} optionalLabel={labels.optional} />
      <Node x={xs[1]} icon={faCalendarDay} step={labels.plan} />
      <Node x={xs[2]} icon={faPersonRunning} step={labels.act} />
      <Node x={xs[3]} icon={faPenToSquare} step={labels.reflect} />
    </svg>
  );
}
