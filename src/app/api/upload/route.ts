import { NextResponse } from "next/server";
import { getRole, sameOrigin } from "@/lib/auth";
import { repository } from "@/server/persistence";
import { randomUUID } from "node:crypto";
export async function POST(req: Request) {
  if (!sameOrigin(req) || !(await getRole()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const form = await req.formData(),
      file = form.get("file");
    if (!(file instanceof File) || file.size > 5 * 1024 * 1024)
      throw new Error("JPEG, PNG or WebP, maximum 5 MB.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const type =
      bytes[0] === 0xff && bytes[1] === 0xd8
        ? "jpg"
        : bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? "png"
          : bytes.subarray(0, 4).toString() === "RIFF" &&
              bytes.subarray(8, 12).toString() === "WEBP"
            ? "webp"
            : null;
    if (!type) throw new Error("Only JPEG, PNG and WebP files are accepted.");
    const name = `${randomUUID()}.${type}`;
    const url = await (
      await repository("media")
    ).storePublicMedia(
      name,
      bytes,
      type === "jpg" ? "image/jpeg" : `image/${type}`,
      "image",
    );
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 400 },
    );
  }
}
