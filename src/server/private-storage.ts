import "server-only";
import path from "node:path";
/** Server-owned path, independent of a release folder when configured on Hostinger. */
export function privateStorageRoot(
  env: Record<string, string | undefined> = process.env,
  cwd = process.cwd(),
) {
  const configured = env.PRIVATE_STORAGE_ROOT?.trim();
  if (configured && !path.isAbsolute(configured))
    throw Error("PRIVATE_STORAGE_ROOT_MUST_BE_ABSOLUTE");
  const root = path.resolve(configured || path.join(cwd, ".data"));
  if (env.DEPLOYMENT_TARGET === "hostinger" && env.NODE_ENV === "production") {
    if (!configured) throw Error("PRIVATE_STORAGE_ROOT_REQUIRED");
    const relative = path.relative(cwd, root);
    if (
      !relative ||
      (!relative.startsWith(".." + path.sep) &&
        relative !== ".." &&
        !path.isAbsolute(relative))
    )
      throw Error("PRIVATE_STORAGE_ROOT_MUST_BE_OUTSIDE_RELEASE");
    if (
      root
        .split(path.sep)
        .some((part) => ["public", "public_html"].includes(part))
    )
      throw Error("PRIVATE_STORAGE_ROOT_MUST_BE_PRIVATE");
  }
  for (const forbidden of [path.join(cwd, "public"), path.join(cwd, ".next")]) {
    const relative = path.relative(forbidden, root);
    if (
      !relative ||
      (!relative.startsWith(".." + path.sep) &&
        relative !== ".." &&
        !path.isAbsolute(relative))
    )
      throw Error("PRIVATE_STORAGE_ROOT_MUST_BE_PRIVATE");
  }
  return root;
}
