export const maxHeroVideoBytes = 50 * 1024 * 1024;
export type HeroVideoAsset = {
  src: string;
  name: string;
  mime: "video/mp4" | "video/webm";
  size: number;
};
const databaseName = "kuzmin-public-video-assets-v1";
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("videos");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        Error("Video deposu açılamadı. Tarayıcı depolamasını kontrol edin."),
      );
  });
}
async function storeVideo(id: string, blob: Blob) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("videos", "readwrite");
      tx.objectStore("videos").put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(
          Error(
            "Video kaydedilemedi. Tarayıcıda yeterli alan olduğundan emin olun.",
          ),
        );
    });
  } finally {
    db.close();
  }
}
export async function browserVideoBlob(src: string): Promise<Blob | null> {
  if (!src.startsWith("idb:")) return null;
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("videos", "readonly"),
        request = tx.objectStore("videos").get(src.slice(4));
      tx.oncomplete = () => resolve(request.result || null);
      tx.onerror = () => reject(Error("Video okunamadı."));
    });
  } finally {
    db.close();
  }
}
export async function validateHeroVideoFile(file: File) {
  if (file.size < 12 || file.size > maxHeroVideoBytes)
    throw Error("MP4 veya WebM video seçin (en fazla 50 MB).");
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mp4 = String.fromCharCode(...head.slice(4, 8)) === "ftyp";
  const webm =
    head[0] === 0x1a &&
    head[1] === 0x45 &&
    head[2] === 0xdf &&
    head[3] === 0xa3;
  if (
    (!mp4 || file.type !== "video/mp4") &&
    (!webm || file.type !== "video/webm")
  )
    throw Error("Yalnızca geçerli MP4 ve WebM videolar yüklenebilir.");
  return (mp4 ? "video/mp4" : "video/webm") as HeroVideoAsset["mime"];
}
export async function saveBrowserVideo(file: File): Promise<HeroVideoAsset> {
  const mime = await validateHeroVideoFile(file);
  await validateBrowserVideo(file);
  const id = crypto.randomUUID();
  await storeVideo(id, file);
  return {
    src: "idb:" + id,
    name: file.name.slice(0, 200),
    mime,
    size: file.size,
  };
}
export async function validateBrowserVideo(file: File) {
  const url = URL.createObjectURL(file),
    video = document.createElement("video");
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Video açılamadı. MP4 (H.264) veya WebM kullanın.")),
        8000,
      );
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        if (video.videoWidth && video.videoHeight) resolve();
        else reject(Error("Video görüntüsü bulunamadı."));
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(Error("Video açılamadı. MP4 (H.264) veya WebM kullanın."));
      };
      video.src = url;
    });
  } finally {
    video.onloadedmetadata = null;
    video.onerror = null;
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
export async function exportBrowserVideo(video?: HeroVideoAsset) {
  if (!video?.src.startsWith("idb:")) return undefined;
  const blob = await browserVideoBlob(video.src);
  if (!blob)
    throw Error(
      "Banner videosu bulunamadı. Yedeği almadan önce videoyu yeniden yükleyin.",
    );
  const bytes = new Uint8Array(await blob.arrayBuffer()),
    chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 32768)
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
  return { src: video.src, data: btoa(chunks.join("")) };
}
export async function importBrowserVideo(
  video: HeroVideoAsset | undefined,
  media: unknown,
) {
  if (!video?.src.startsWith("idb:")) return;
  const value = media as { src?: string; data?: string } | undefined;
  if (
    !value ||
    value.src !== video.src ||
    typeof value.data !== "string" ||
    value.data.length > Math.ceil((maxHeroVideoBytes * 4) / 3) + 4
  ) {
    if (await browserVideoBlob(video.src)) return;
    throw Error("Yedekte banner videosu bulunamadı. Videoyu yeniden yükleyin.");
  }
  const text = atob(value.data),
    bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  const file = new File([bytes], video.name, { type: video.mime });
  await validateHeroVideoFile(file);
  if (file.size !== video.size) throw Error("Video yedeği eksik veya bozuk.");
  if (!(await browserVideoBlob(video.src)))
    await storeVideo(video.src.slice(4), file);
}
