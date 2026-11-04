import type { SiteSnapshot, SiteVersion } from "./site-version";
export const browserPublicationKey =
  "kuzmin.workspace.gsgvhlcglf-blip.dassda.v1.published";
const databaseName = "kuzmin-site-versions-v1";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("versions", { keyPath: "id" });
      request.result.createObjectStore("settings");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(Error("Tarayıcı sürüm deposu açılamadı."));
  });
}
export async function browserVersions() {
  const db = await database();
  try {
    return await new Promise<{
      current: string | null;
      history: SiteVersion[];
    }>((resolve, reject) => {
      const tx = db.transaction(["versions", "settings"], "readonly"),
        all = tx.objectStore("versions").getAll(),
        current = tx.objectStore("settings").get("current");
      tx.oncomplete = () =>
        resolve({
          current: current.result || null,
          history: (all.result as SiteVersion[]).sort((a, b) =>
            b.created_at.localeCompare(a.created_at),
          ),
        });
      tx.onerror = () => reject(Error("Sürümler okunamadı."));
    });
  } finally {
    db.close();
  }
}
export async function browserPublished(fallback: SiteSnapshot) {
  const data = await browserVersions();
  return data.history.find((r) => r.id === data.current)?.snapshot || fallback;
}
export async function publishBrowserSnapshot(
  snapshot: SiteSnapshot,
  label: string,
  backup?: SiteSnapshot,
) {
  const db = await database(),
    version: SiteVersion = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      label: label.slice(0, 120),
      kind: "published",
      snapshot: structuredClone(snapshot),
    };
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["versions", "settings"], "readwrite"),
        versions = tx.objectStore("versions");
      if (backup)
        versions.put({
          id: crypto.randomUUID(),
          created_at: new Date(Date.now() - 1).toISOString(),
          label: "Geri almadan önceki taslak",
          kind: "draft_backup",
          snapshot: structuredClone(backup),
        });
      versions.put(version);
      tx.objectStore("settings").put(version.id, "current");
      const all = versions.getAll();
      all.onsuccess = () => {
        const list = (all.result as SiteVersion[]).sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        );
        for (const old of list.slice(12))
          if (old.id !== version.id) versions.delete(old.id);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(
          Error("Sürüm kaydedilemedi. Tarayıcı depolama alanını kontrol edin."),
        );
    });
  } finally {
    db.close();
  }
  try {
    localStorage.setItem(
      browserPublicationKey,
      JSON.stringify({ id: version.id, at: version.created_at }),
    );
  } catch {
    /* Published version is still durable in IndexedDB; the customer view also refreshes on focus. */
  }
  window.dispatchEvent(new Event("kz-site-published"));
  return version;
}
