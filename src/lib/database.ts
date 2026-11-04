import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { seed } from "./seed";
import { tableNames, type Table, type Row, type Catalog } from "./types";
export const isLive = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
export const localEnabled =
  (!isLive && process.env.NODE_ENV !== "production") ||
  (!isLive && process.env.ALLOW_LOCAL_DEMO === "true" && !process.env.VERCEL);
let db: DatabaseSync;
const jsonFields = new Set([
  "title",
  "description",
  "specifications",
  "installation",
  "name_i18n",
  "alt",
  "body",
]);
function encode(r: Row) {
  return Object.fromEntries(
    Object.entries(r).map(([k, v]) => [
      k,
      typeof v === "object" && v !== null
        ? JSON.stringify(v)
        : typeof v === "boolean"
          ? Number(v)
          : v,
    ]),
  );
}
function decode(r: Record<string, unknown>): Row {
  return Object.fromEntries(
    Object.entries(r).map(([k, v]) => [
      k,
      typeof v === "string" &&
      (jsonFields.has(k) || k === "name") &&
      v.startsWith("{")
        ? JSON.parse(v)
        : ["featured", "published", "demo"].includes(k)
          ? !!v
          : v,
    ]),
  ) as Row;
}
export function localDB() {
  if (!localEnabled)
    throw new Error(
      "Supabase configuration required. Local demo is disabled in production.",
    );
  if (db) return db;
  mkdirSync(path.join(process.cwd(), ".data"), { recursive: true });
  db = new DatabaseSync(path.join(process.cwd(), ".data/store.sqlite"));
  db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
  db.exec(`
 CREATE TABLE IF NOT EXISTS brands(id TEXT PRIMARY KEY,slug TEXT NOT NULL UNIQUE CHECK(slug IN ('ducati','bmw','yamaha')),name TEXT NOT NULL,position INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS models(id TEXT PRIMARY KEY,brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,slug TEXT NOT NULL,name TEXT NOT NULL,image TEXT NOT NULL DEFAULT '', UNIQUE(brand_id,slug));
 CREATE TABLE IF NOT EXISTS generations(id TEXT PRIMARY KEY,model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,name TEXT NOT NULL,start_year INTEGER NOT NULL,end_year INTEGER NOT NULL,CHECK(start_year<=end_year));
 CREATE TABLE IF NOT EXISTS model_years(id TEXT PRIMARY KEY,model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,generation_id TEXT NOT NULL REFERENCES generations(id) ON DELETE CASCADE,year INTEGER NOT NULL,UNIQUE(model_id,year));
 CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY,slug TEXT NOT NULL UNIQUE,name TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,slug TEXT NOT NULL UNIQUE,sku TEXT NOT NULL UNIQUE,title TEXT NOT NULL,description TEXT NOT NULL,specifications TEXT NOT NULL,category_id TEXT NOT NULL REFERENCES categories(id),material TEXT NOT NULL,price REAL NOT NULL CHECK(price>=0),stock INTEGER NOT NULL CHECK(stock>=0),featured INTEGER NOT NULL,published INTEGER NOT NULL,demo INTEGER NOT NULL,weight REAL,installation TEXT NOT NULL,video_url TEXT NOT NULL DEFAULT '',viewer_url TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS variants(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,name TEXT NOT NULL,sku TEXT NOT NULL UNIQUE,price REAL NOT NULL CHECK(price>=0),stock INTEGER NOT NULL CHECK(stock>=0),finish TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS product_images(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,url TEXT NOT NULL,alt TEXT NOT NULL,position INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS compatibility(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,generation_id TEXT REFERENCES generations(id) ON DELETE CASCADE,year_from INTEGER NOT NULL,year_to INTEGER NOT NULL,CHECK(year_from<=year_to),UNIQUE(product_id,model_id,year_from,year_to));
 CREATE TABLE IF NOT EXISTS content(id TEXT PRIMARY KEY,key TEXT NOT NULL UNIQUE,title TEXT NOT NULL,body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,reference TEXT NOT NULL UNIQUE,customer_name TEXT NOT NULL,email TEXT NOT NULL,phone TEXT NOT NULL,address TEXT NOT NULL,note TEXT NOT NULL,status TEXT NOT NULL,total REAL NOT NULL,currency TEXT NOT NULL,demo INTEGER NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS order_items(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,product_id TEXT NOT NULL REFERENCES products(id),variant_id TEXT NOT NULL REFERENCES variants(id),title TEXT NOT NULL,sku TEXT NOT NULL,quantity INTEGER NOT NULL,unit_price REAL NOT NULL);
 CREATE INDEX IF NOT EXISTS fitment_lookup ON compatibility(model_id,year_from,year_to);
 `);
  db.exec(
    "CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL)",
  );
  db.exec(`CREATE TABLE IF NOT EXISTS analytics_settings(id TEXT PRIMARY KEY CHECK(id='site'),enabled INTEGER NOT NULL DEFAULT 0,retention_days INTEGER NOT NULL DEFAULT 30 CHECK(retention_days IN(7,30,90)));
  INSERT OR IGNORE INTO analytics_settings(id) VALUES('site');
  CREATE TABLE IF NOT EXISTS analytics_events(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,kind TEXT NOT NULL,path TEXT NOT NULL,viewport_width INTEGER NOT NULL,viewport_height INTEGER NOT NULL,document_width INTEGER NOT NULL,document_height INTEGER NOT NULL,x REAL,y REAL,depth REAL,referrer_host TEXT NOT NULL,revision TEXT NOT NULL,created_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS analytics_event_time ON analytics_events(created_at);
  CREATE INDEX IF NOT EXISTS analytics_event_path ON analytics_events(path,viewport_width,viewport_height,created_at);`);
  const orderColumns = db.prepare("PRAGMA table_info(orders)").all() as {
    name: string;
  }[];
  if (!orderColumns.some((column) => column.name === "customer_id"))
    db.exec(
      "ALTER TABLE orders ADD COLUMN customer_id TEXT REFERENCES customers(id)",
    );
  db.exec(
    "CREATE INDEX IF NOT EXISTS orders_customer ON orders(customer_id,created_at)",
  );
  if (
    !(db.prepare("SELECT count(*) as n FROM brands").get() as { n: number }).n
  ) {
    db.exec("BEGIN");
    try {
      for (const t of [
        "brands",
        "models",
        "generations",
        "model_years",
        "categories",
        "products",
        "variants",
        "product_images",
        "compatibility",
        "content",
      ] as (keyof Catalog)[])
        for (const r of seed[t]) insertLocal(t, r);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return db;
}
export function rowsLocal(t: Table) {
  if (!tableNames.includes(t)) throw new Error("Invalid table");
  return localDB()
    .prepare(`SELECT * FROM ${t}`)
    .all()
    .map((r) => decode(r));
}
export function insertLocal(t: Table, r: Row) {
  const d = encode(r),
    keys = Object.keys(d);
  if (!tableNames.includes(t) || keys.some((k) => !/^[a-z_]+$/.test(k)))
    throw new Error("Invalid fields");
  localDB()
    .prepare(
      `INSERT INTO ${t} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
    )
    .run(...(Object.values(d) as (string | number | null)[]));
}
export function updateLocal(t: Table, r: Row) {
  const d = encode(r),
    keys = Object.keys(d).filter((k) => k !== "id");
  localDB()
    .prepare(
      `UPDATE ${t} SET ${keys.map((k) => `${k}=?`).join(",")} WHERE id=?`,
    )
    .run(...(keys.map((k) => d[k]) as (string | number | null)[]), r.id);
}
export function deleteLocal(t: Table, id: string) {
  localDB().prepare(`DELETE FROM ${t} WHERE id=?`).run(id);
}
