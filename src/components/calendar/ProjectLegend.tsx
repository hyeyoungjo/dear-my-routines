"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxArchive,
  faEye,
  faEyeSlash,
  faTrashCan,
} from "@fortawesome/free-solid-svg-icons";
import { projectColor, PROJECT_COLORS } from "@/lib/projectColor";
import { ColorPicker } from "@/components/ColorPicker";
import { activeProjects, isProjectHidden } from "@/core/project";
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

  // Only active projects appear in the legend; deactivated ones move to the
  // Shelf (ADR-028). Stable order (creation time) so chips don't jump on refetch.
  const projects = activeProjects(data ?? [])
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
        const hidden = isProjectHidden(p);
        return (
          <div
            key={p.projectId}
            // Capsule tinted with the project colour; text stays foreground for
            // readability (a faint tint + dark text reads on any hue). Dimmed
            // when hidden from the calendar so the state is visible (ADR-028).
            style={{ backgroundColor: `${c}22`, borderColor: `${c}66` }}
            className={`group flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-1 text-xs text-foreground${
              hidden ? " opacity-50" : ""
            }`}
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
              className="w-16 bg-transparent text-foreground placeholder:text-muted focus:outline-none"
            />
            {/* Action icons — tight group, revealed on chip hover (like a task
                block's controls). Reserved by opacity so the chip width is stable. */}
            <div className="flex items-center gap-0.5">
              {/* Deactivate: park the project in the Shelf (same box-archive
                  metaphor as shelving a task, ADR-026/028). Optimistic. */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateProject.mutate({
                    projectId: p.projectId,
                    patch: { deactivatedAt: new Date() },
                  });
                }}
                aria-label={t("deactivate")}
                title={t("deactivate")}
                className="shrink-0 rounded px-0.5 text-[10px] text-muted opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              >
                <FontAwesomeIcon icon={faBoxArchive} />
              </button>
              {/* Toggle calendar visibility of this project's blocks. Optimistic. */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateProject.mutate({
                    projectId: p.projectId,
                    patch: { hiddenAt: hidden ? null : new Date() },
                  });
                }}
                aria-label={hidden ? t("show") : t("hide")}
                title={hidden ? t("show") : t("hide")}
                className="shrink-0 rounded px-0.5 text-[10px] text-muted opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              >
                <FontAwesomeIcon icon={hidden ? faEyeSlash : faEye} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeProject.mutate(p.projectId);
                }}
                aria-label={t("delete")}
                title={t("delete")}
                className="shrink-0 rounded px-0.5 text-[10px] text-muted opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
              >
                <FontAwesomeIcon icon={faTrashCan} />
              </button>
            </div>
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
