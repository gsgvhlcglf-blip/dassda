import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
/** Identifies this folder, without returning its path. Not an authentication token. */
export function installationId(root = process.cwd()) {
  return createHash("sha256")
    .update(realpathSync(root))
    .digest("hex")
    .slice(0, 24);
}
