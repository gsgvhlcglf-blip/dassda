import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { getRole, sameOrigin } from "@/lib/auth";
import { isLive } from "@/lib/database";
import { supabase } from "@/lib/supabase";
import { boundedForm } from "@/lib/request-store";
import { validateHeroVideoFile, maxHeroVideoBytes } from "@/lib/hero-video";
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!sameOrigin(req) || !(await getRole()))
    return NextResponse.json(
      { error: "Yönetici girişi gerekli." },
      { status: 401 },
    );
  try {
    const form = await boundedForm(req, maxHeroVideoBytes + 1024 * 1024),
      file = form.get("file");
    if (!(file instanceof File)) throw Error("MP4 veya WebM video seçin.");
    const mime = await validateHeroVideoFile(file),
      name = randomUUID() + (mime === "video/mp4" ? ".mp4" : ".webm");
    const bytes = Buffer.from(await file.arrayBuffer());
    let url: string;
    if (isLive) {
      const db = await supabase();
      const { error } = await db.storage
        .from("site-media")
        .upload(name, bytes, { contentType: mime, upsert: false });
      if (error)
        throw Error(
          "Video yüklenemedi. Site medya deposunu ve barındırma yükleme sınırını kontrol edin.",
        );
      url = db.storage.from("site-media").getPublicUrl(name).data.publicUrl;
    } else {
      await mkdir(path.join(process.cwd(), "public/uploads"), {
        recursive: true,
      });
      await writeFile(path.join(process.cwd(), "public/uploads", name), bytes);
      url = "/api/upload-video?file=" + name;
    }
    return NextResponse.json(
      { src: url, name: file.name.slice(0, 200), mime, size: file.size },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Video yüklenemedi." },
      { status: 400 },
    );
  }
}
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("file") || "";
  if (!/^[a-f0-9-]{36}\.(mp4|webm)$/.test(name))
    return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(
      path.join(process.cwd(), "public/uploads", name),
    );
    const headers: Record<string, string> = {
      "Content-Type": name.endsWith(".mp4") ? "video/mp4" : "video/webm",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    };
    const range = req.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2]))
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": "bytes */" + bytes.length },
        });
      const start = match[1]
        ? Number(match[1])
        : Math.max(0, bytes.length - Number(match[2]));
      const end =
        match[1] && match[2]
          ? Math.min(bytes.length - 1, Number(match[2]))
          : bytes.length - 1;
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start >= bytes.length ||
        end < start
      )
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": "bytes */" + bytes.length },
        });
      headers["Content-Range"] =
        "bytes " + start + "-" + end + "/" + bytes.length;
      headers["Content-Length"] = String(end - start + 1);
      return new Response(bytes.subarray(start, end + 1), {
        status: 206,
        headers,
      });
    }
    headers["Content-Length"] = String(bytes.length);
    return new Response(bytes, { headers });
  } catch {
    return new Response(null, { status: 404 });
  }
}
