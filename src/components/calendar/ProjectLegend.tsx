"use client";

import { projectColor } from "@/lib/projectColor";
import { ColorPicker } from "@/components/ColorPicker";
import {
  useAddNode,
  useNodes,
  useRemoveNode,
  useUpdateNode,
} from "@/hooks/nodes";

/**
 * Top-of-page project legend (PRD: Project is a non-timed grouping). Projects
 * live as `type: "project"` nodes but are NOT drawn on the time grid — they're
 * managed here as colour-capsule chips. The colour is `p.color` (user-picked via
 * the round swatch) or a deterministic `projectColor(id)` fallback; the same
 * colour a task inherits from its project. Add / rename / recolour / delete here.
 */
export function ProjectLegend() {
  const { data: nodes } = useNodes();
  const addNode = useAddNode();
  const updateNode = useUpdateNode();
  const removeNode = useRemoveNode();

  // Stable order (creation time) so chips don't jump on update/refetch.
  const projects = (nodes ?? [])
    .filter((n) => n.type === "project")
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted">Projects</span>

      {projects.map((p) => {
        const c = p.color ?? projectColor(p.id) ?? "#94a3b8";
        return (
          <div
            key={p.id}
            // Capsule tinted with the project colour; text stays foreground for
            // readability (a faint tint + dark text reads on any hue).
            style={{ backgroundColor: `${c}22`, borderColor: `${c}66` }}
            className="flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-1 text-xs text-foreground"
          >
            {/* Custom colour picker (preset palette + hex) — matches the app UI. */}
            <ColorPicker
              value={c}
              onChange={(hex) =>
                updateNode.mutate({ id: p.id, patch: { color: hex } })
              }
            />

            <input
              defaultValue={p.title}
              placeholder="Project"
              onBlur={(e) => {
                const t = e.target.value.trim();
                if (t !== p.title) updateNode.mutate({ id: p.id, patch: { title: t } });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              aria-label="Project name"
              className="w-24 bg-transparent text-foreground placeholder:text-muted focus:outline-none"
            />
            <button
              type="button"
              onClick={() => removeNode.mutate(p.id)}
              aria-label="Delete project"
              title="Delete project"
              className="rounded px-1 text-muted/70 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => addNode.mutate({ title: "", type: "project" })}
        className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
      >
        ＋ Project
      </button>
    </div>
  );
}
