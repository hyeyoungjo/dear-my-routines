import type { Node } from "@/db/schema";

/**
 * A flat row exactly as stored in the `nodes` table (ADR-009): a single
 * self-referencing table where `parentId == null` marks a top-level Area.
 *
 * We reuse the DB-inferred type so the core stays in sync with the schema,
 * but this is a *type-only* import — nothing from Drizzle survives compilation,
 * so `core/` keeps zero runtime dependency on the DB layer (CLAUDE.md CRITICAL).
 */
export type FlatNode = Node;

/**
 * The same node nested for the UI: each node carries its children inline.
 * Depth is arbitrary (ADR-009), so consumers must recurse.
 */
export type TreeNode = FlatNode & { children: TreeNode[] };
