import "server-only";
import { randomUUID } from "node:crypto";
import {
  isLive,
  localDB,
  rowsLocal,
  insertLocal,
  updateLocal,
  deleteLocal,
} from "@/lib/database";
import { supabase } from "@/lib/supabase";
import { getRows } from "@/lib/catalog";
import {
  catalogTables,
  validateCatalog,
  type SiteSnapshot,
  type SiteVersion,
  type Workspace,
} from "@/lib/site-version";
import { validateDesign } from "../../../../../quick-panel/design.mjs";
import type { Catalog, Row } from "@/lib/types";
export function validatedSnapshot(value: SiteSnapshot): SiteSnapshot {
  return {
    catalog: validateCatalog(value.catalog),
    design: validateDesign(value.design) as SiteSnapshot["design"],
  };
}
async function currentCatalog() {
  return Object.fromEntries(
    await Promise.all(
      catalogTables.map(async (table) => [table, await getRows(table)]),
    ),
  ) as Catalog;
}
function localTables() {
  const db = localDB();
  db.exec(
    `CREATE TABLE IF NOT EXISTS site_workspace(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,catalog TEXT NOT NULL,design TEXT NOT NULL,published_id TEXT);CREATE TABLE IF NOT EXISTS site_versions(id TEXT PRIMARY KEY,created_at TEXT NOT NULL,label TEXT NOT NULL,kind TEXT NOT NULL,catalog TEXT NOT NULL,design TEXT NOT NULL);CREATE TABLE IF NOT EXISTS site_presentation(id TEXT PRIMARY KEY,design TEXT NOT NULL);INSERT OR IGNORE INTO site_presentation VALUES('site','{"texts":{},"images":{}}');`,
  );
  return db;
}
function parseRow(row: Record<string, unknown>) {
  return {
    ...row,
    snapshot: {
      catalog:
        typeof row.catalog === "string" ? JSON.parse(row.catalog) : row.catalog,
      design: validateDesign(
        typeof row.design === "string" ? JSON.parse(row.design) : row.design,
      ),
    },
  };
}
export async function publishedDesign() {
  if (isLive) {
    const { data, error } = await (
      await supabase()
    )
      .from("site_presentation")
      .select("design")
      .eq("id", "site")
      .maybeSingle();
    if (error) return validateDesign(null) as SiteSnapshot["design"];
    return validateDesign(data?.design) as SiteSnapshot["design"];
  }
  const row = localTables()
    .prepare("SELECT design FROM site_presentation WHERE id='site'")
    .get() as { design: string };
  return validateDesign(JSON.parse(row.design)) as SiteSnapshot["design"];
}
export async function getWorkspace(): Promise<Workspace> {
  let row: Record<string, unknown>;
  if (isLive) {
    const { data, error } = await (await supabase()).rpc("get_site_workspace");
    if (error)
      throw Error(
        "Yayın altyapısı için 005_site_versions.sql göçünü uygulayın.",
      );
    row = data;
  } else {
    const db = localTables();
    db.prepare(
      "INSERT OR IGNORE INTO site_workspace VALUES('site',1,?,?,NULL)",
    ).run(
      JSON.stringify(await currentCatalog()),
      JSON.stringify(await publishedDesign()),
    );
    row = db.prepare("SELECT * FROM site_workspace WHERE id='site'").get()!;
    row.history = db
      .prepare(
        "SELECT id,created_at,label,kind FROM site_versions ORDER BY created_at DESC",
      )
      .all();
  }
  const parsed = parseRow(row),
    catalog = parsed.snapshot.catalog as Catalog;
  // Inventory is operational data. Never rewind stock when publishing or restoring content.
  for (const table of ["products", "variants"] as const) {
    const actual = await getRows(table);
    for (const item of catalog[table]) {
      const live = actual.find((r) => r.id === item.id);
      if (live) item.stock = Number(live.stock);
    }
  }
  return {
    revision: Number(row.revision),
    snapshot: {
      catalog,
      design: parsed.snapshot.design as SiteSnapshot["design"],
    },
    published_id: row.published_id as string | null,
    history: row.history as Workspace["history"],
  };
}
export async function saveWorkspace(
  expected: number,
  snapshot: SiteSnapshot,
  inventory?: { table: "products" | "variants"; id: string; stock: number },
) {
  snapshot = validatedSnapshot(snapshot);
  if (isLive) {
    const { error } = await (
      await supabase()
    ).rpc("save_site_workspace", {
      expected,
      new_catalog: snapshot.catalog,
      new_design: snapshot.design,
      inventory: inventory || null,
    });
    if (error) throw Error(error.message);
    return;
  }
  const db = localTables();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = db
      .prepare(
        "UPDATE site_workspace SET catalog=?,design=?,revision=revision+1 WHERE id='site' AND revision=?",
      )
      .run(
        JSON.stringify(snapshot.catalog),
        JSON.stringify(snapshot.design),
        expected,
      );
    if (!result.changes) throw Error("WORKSPACE_CONFLICT");
    if (inventory)
      db.prepare(`UPDATE ${inventory.table} SET stock=? WHERE id=?`).run(
        inventory.stock,
        inventory.id,
      );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
function localSnapshot(): SiteSnapshot {
  return {
    catalog: Object.fromEntries(
      catalogTables.map((t) => [t, rowsLocal(t)]),
    ) as Catalog,
    design: JSON.parse(
      (
        localTables()
          .prepare("SELECT design FROM site_presentation WHERE id='site'")
          .get() as { design: string }
      ).design,
    ),
  };
}
function insertVersion(
  snapshot: SiteSnapshot,
  label: string,
  kind: SiteVersion["kind"] = "published",
) {
  const id = randomUUID();
  localTables()
    .prepare("INSERT INTO site_versions VALUES(?,?,?,?,?,?)")
    .run(
      id,
      new Date().toISOString(),
      label,
      kind,
      JSON.stringify(snapshot.catalog),
      JSON.stringify(snapshot.design),
    );
  return id;
}
export async function publishWorkspace(expected: number, restoreId?: string) {
  if (isLive) {
    const { data, error } = await (
      await supabase()
    ).rpc("publish_site_workspace", {
      expected,
      restore_id: restoreId || null,
    });
    if (error) throw Error(error.message);
    return data as string;
  }
  const db = localTables();
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db
      .prepare("SELECT * FROM site_workspace WHERE id='site'")
      .get()!;
    if (Number(row.revision) !== expected) throw Error("WORKSPACE_CONFLICT");
    const current = parseRow(row).snapshot as SiteSnapshot;
    if (!row.published_id) insertVersion(localSnapshot(), "İlk yayın öncesi");
    let target = current;
    if (restoreId) {
      const old = db
        .prepare("SELECT * FROM site_versions WHERE id=?")
        .get(restoreId);
      if (!old) throw Error("VERSION_NOT_FOUND");
      target = parseRow(old).snapshot as SiteSnapshot;
      insertVersion(current, "Geri almadan önceki taslak", "draft_backup");
    }
    target = validatedSnapshot(target);
    db.exec("DELETE FROM compatibility;DELETE FROM model_years");
    for (const table of catalogTables) {
      const old = rowsLocal(table);
      for (const item of target.catalog[table]) {
        const exists = old.find((r) => r.id === item.id);
        const record = { ...item } as Row;
        if (exists && (table === "products" || table === "variants"))
          record.stock = exists.stock;
        if (exists) updateLocal(table, record);
        else insertLocal(table, record);
      }
    }
    for (const table of [
      "compatibility",
      "product_images",
      "variants",
      "products",
      "model_years",
      "generations",
      "models",
      "categories",
      "content",
    ] as const)
      for (const old of rowsLocal(table))
        if (!target.catalog[table].some((r) => r.id === old.id))
          deleteLocal(table, old.id);
    const snapshot = { ...localSnapshot(), design: target.design },
      id = insertVersion(snapshot, restoreId ? "Geri yüklenen yayın" : "Yayın");
    db.prepare("UPDATE site_presentation SET design=? WHERE id='site'").run(
      JSON.stringify(target.design),
    );
    db.prepare(
      "UPDATE site_workspace SET catalog=?,design=?,published_id=?,revision=revision+1 WHERE id='site'",
    ).run(
      JSON.stringify(snapshot.catalog),
      JSON.stringify(snapshot.design),
      id,
    );
    db.exec(
      "DELETE FROM site_versions WHERE id IN(SELECT id FROM site_versions ORDER BY created_at DESC,rowid DESC LIMIT -1 OFFSET 12)",
    );
    db.exec("COMMIT");
    return id;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
