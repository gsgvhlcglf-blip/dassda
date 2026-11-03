import net from "node:net";
import { spawn } from "node:child_process";
import { installationId } from "../src/lib/local-installation.mjs";
/** @param {number} port @param {string} root */
export async function probeInstallation(port, root) {
  try {
    const response = await fetch(`http://localhost:${port}/api/local-status`, {
      signal: AbortSignal.timeout(1200),
      redirect: "error",
    });
    if (!response.ok) return false;
    const data = await response.json();
    return (
      data.app === "kuzmin-local" &&
      data.ready === true &&
      data.installation === installationId(root)
    );
  } catch {
    return false;
  }
}
/** @param {number} port */
function isFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}
/** @param {string} root @param {number} [preferred] */
export async function selectLocalPort(root, preferred = 3000) {
  if (!Number.isInteger(preferred) || preferred < 1024 || preferred > 65525)
    throw new Error("Gecersiz yerel port.");
  let free = 0;
  for (let port = preferred; port < preferred + 10; port++) {
    if (await probeInstallation(port, root)) return { port, existing: true };
    if (!free && (await isFree(port))) free = port;
  }
  if (free) return { port: free, existing: false };
  throw new Error(
    "Bos yerel port bulunamadi. Acik KUZMIN pencerelerini kontrol edin.",
  );
}
/** @param {string} url */
export function openBrowser(url) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "http:" ||
    parsed.hostname !== "localhost" ||
    !/^\/(admin(\/ayarlar)?)?$/.test(parsed.pathname)
  )
    throw new Error("Gecersiz yerel adres.");
  if (process.platform === "win32") {
    console.log(`Tarayicinizda bu adresi acin: ${url}`);
    return;
  }
  const command = process.platform === "darwin" ? "open" : "xdg-open";
  const args = [url];
  const child = spawn(command, args, { stdio: "ignore", windowsHide: true });
  child.on("error", () => console.log(`Tarayicinizda bu adresi acin: ${url}`));
  child.unref();
}
