import "server-only";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { isLive, localEnabled } from "@/lib/database";
import { supabase } from "@/lib/supabase";

export async function storePublicMedia(
  name: string,
  bytes: Buffer,
  mime: string,
  kind: "image" | "video",
) {
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp|mp4|webm)$/.test(name))
    throw Error("MEDIA_NAME_INVALID");
  if (isLive) {
    const db = await supabase(),
      bucket = kind === "video" ? "site-media" : "catalog";
    const { error } = await db.storage
      .from(bucket)
      .upload(name, bytes, { contentType: mime, upsert: false });
    if (error)
      throw Error(
        "Medya yüklenemedi. Depo ve yükleme sınırlarını kontrol edin.",
      );
    return db.storage.from(bucket).getPublicUrl(name).data.publicUrl;
  }
  if (!localEnabled) throw Error("LOCAL_DEMO_DISABLED");
  await mkdir(path.join(process.cwd(), "public/uploads"), { recursive: true });
  await writeFile(path.join(process.cwd(), "public/uploads", name), bytes);
  return kind === "video"
    ? "/api/upload-video?file=" + name
    : "/uploads/" + name;
}

export async function readLocalVideo(name: string) {
  if (!localEnabled || !/^[a-f0-9-]{36}\.(mp4|webm)$/.test(name))
    throw Error("MEDIA_NOT_FOUND");
  return readFile(path.join(process.cwd(), "public/uploads", name));
}
