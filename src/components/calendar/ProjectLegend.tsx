"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashCan } from "@fortawesome/free-solid-svg-icons";
import { projectColor, PROJECT_COLORS } from "@/lib/projectColor";
import { ColorPicker } from "@/components/ColorPicker";
import {
  useAddProject,
  useProjects,
  useRemoveProject,
  useUpdateProject,
} from "@/hooks/projects";
import { useTranslations } from "next-intl";

/**
 * Top-of-page project legend (PRD: Project is a non-timed grouping). Projects are
 * their own list now (ADR-016 drops the nodes tree) — never drawn on the time
 * grid, managed here as colour-capsule chips. The colour is `projectColor` (user
 * pick via the round swatch) or a deterministic `projectColor(id)` fallback; the
 * same colour a task inherits from its project. Add / rename / recolour / delete.
 */
export function ProjectLegend() {
  const t = useTranslations("projects");
  const { data } = useProjects();
  const addProject = useAddProject();
  const updateProject = useUpdateProject();
  const removeProject = useRemoveProject();

  // Stable order (creation time) so chips don't jump on update/refetch.
  const projects = (data ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime(),
    );

  return (
    <div className="flex flex-nowrap items-center gap-2">
      <span className="shrink-0 text-xs font-medium text-muted">{t("label")}</span>

      {projects.map((p) => {
        const c = p.projectColor ?? projectColor(p.projectId) ?? "#94a3b8";
        return (
          <div
            key={p.projectId}
            // Capsule tinted with the project colour; text stays foreground for
            // readability (a faint tint + dark text reads on any hue).
            style={{ backgroundColor: `${c}22`, borderColor: `${c}66` }}
            className="flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-1 text-xs text-foreground"
          >
            {/* Custom colour picker (preset palette + hex) — matches the app UI. */}
            <ColorPicker
              value={c}
              onChange={(hex) =>
                updateProject.mutate({
                  projectId: p.projectId,
                  patch: { projectColor: hex },
                })
              }
            />

            <input
              defaultValue={p.title}
              placeholder={t("namePlaceholder")}
              onBlur={(e) => {
                const t = e.target.value.trim();
                if (t !== p.title)
                  updateProject.mutate({
                    projectId: p.projectId,
                    patch: { title: t },
                  });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              aria-label={t("nameLabel")}
              className="w-24 bg-transparent text-foreground placeholder:text-muted focus:outline-none"
            />
            <button
              type="button"
              onClick={() => removeProject.mutate(p.projectId)}
              aria-label={t("delete")}
              title={t("delete")}
              className="rounded px-1 text-muted/70 hover:text-red-500"
            >
              <FontAwesomeIcon icon={faTrashCan} />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        // Assign a concrete palette colour up front so the chip's colour is a
        // stored value, not the volatile id-derived fallback: the optimistic row
        // uses a client uuid that the server replaces on refetch, which would flip
        // an id-derived colour. Cycling by count spreads hues across projects.
        onClick={() =>
          addProject.mutate({
            title: "",
            projectColor:
              PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
          })
        }
        className="shrink-0 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
      >
        {t("add")}
      </button>
    </div>
  );
}
