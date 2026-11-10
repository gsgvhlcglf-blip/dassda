import {
  cp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export async function packageHostinger(root = process.cwd()) {
  const source = path.join(root, ".next", "standalone"),
    destination = path.join(root, "artifacts", "hostinger");
  await readFile(path.join(source, "server.js"));
  const marker = path.join(destination, ".hostinger-build.json");
  try {
    const previous = JSON.parse(await readFile(marker, "utf8"));
    if (previous.project !== "kuzmin-carbon")
      throw Error("HOSTINGER_OUTPUT_NOT_OWNED");
    await rm(destination, { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const names = await readdir(destination).catch(() => []);
    if (names.length) throw Error("HOSTINGER_OUTPUT_NOT_OWNED");
  }
  await mkdir(destination, { recursive: true });
  const forbidden = (file) =>
    path
      .relative(root, file)
      .split(path.sep)
      .some(
        (part) =>
          part.startsWith(".env") ||
          [".data", ".git", "downloads", "docs", "uploads"].includes(part),
      );
  const safe = async (file) => {
    if (forbidden(file)) return false;
    const resolved = await realpath(file),
      relative = path.relative(root, resolved);
    if (
      relative === ".." ||
      relative.startsWith(".." + path.sep) ||
      path.isAbsolute(relative)
    )
      throw Error("HOSTINGER_EXTERNAL_SYMLINK");
    return !forbidden(resolved);
  };
  await cp(source, destination, {
    recursive: true,
    dereference: true,
    filter: safe,
  });
  await cp(
    path.join(root, ".next", "static"),
    path.join(destination, ".next", "static"),
    { recursive: true, filter: safe },
  );
  await cp(path.join(root, "public"), path.join(destination, "public"), {
    recursive: true,
    filter: safe,
  });
  await writeFile(
    marker,
    JSON.stringify({
      project: "kuzmin-carbon",
      target: "hostinger",
      node: ">=24",
      created_at: new Date().toISOString(),
    }),
  );
  return destination;
}
if (
  process.argv[1] &&
  path.basename(process.argv[1]) === "package-hostinger.mjs"
) {
  packageHostinger()
    .then((folder) => console.log("Hostinger application bundle:", folder))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
