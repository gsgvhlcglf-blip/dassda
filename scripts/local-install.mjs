import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readSecret } from "./read-secret.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
delete env.NODE_ENV;
process.chdir(root);
function runNode(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env,
      stdio: [input === undefined ? "inherit" : "pipe", "inherit", "inherit"],
    });
    child.once("error", reject);
    if (input !== undefined) {
      child.stdin.on("error", () => {});
      child.stdin.end(input);
    }
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `Islem tamamlanamadi (kod ${code}). Yukaridaki mesaji kontrol edin.`,
            ),
          ),
    );
  });
}
async function main() {
  if (Number(process.versions.node.split(".")[0]) < 24)
    throw new Error(
      "Once resmi nodejs.org sitesinden Node.js 24 veya daha yeni bir LTS surumu kurun.",
    );
  const directory = path.dirname(process.execPath);
  const npm = [
    path.join(directory, "node_modules/npm/bin/npm-cli.js"),
    path.resolve(directory, "../lib/node_modules/npm/bin/npm-cli.js"),
  ].find(existsSync);
  if (!npm)
    throw new Error(
      "Resmi Node.js kurulumuyla gelen npm bulunamadi. nodejs.org kurulumunu kontrol edin.",
    );
  console.log(
    "KUZMIN - Yerel kurulum\nIlk kurulum internet gerektirir. Uygulama mevcut Node.js kurulumunu kullanir.",
  );
  if (!existsSync(".env.local")) {
    let password = await readSecret(
      "Yonetim sifrenizi belirleyin (12-128 karakter, ekranda gorunmez): ",
    );
    let confirmation = await readSecret("Sifrenizi tekrar girin: ");
    try {
      if (password.length < 12 || password.length > 128)
        throw new Error("Sifre 12-128 karakter arasinda olmali.");
      if (password !== confirmation)
        throw new Error("Sifreler ayni degil. Komutu tekrar calistirin.");
      await runNode(
        [path.join(root, "scripts/setup-demo.mjs"), "--password-stdin"],
        password + "\n",
      );
    } finally {
      password = "";
      confirmation = "";
    }
  } else console.log("Mevcut yerel hesap ve veriler korunuyor.");
  console.log("1/2 - Kilit dosyasindaki bagimliliklar kuruluyor...");
  await runNode([
    npm,
    "ci",
    "--include=dev",
    "--include=optional",
    "--no-fund",
  ]);
  console.log("2/2 - Uygulama bilgisayariniz icin hazirlaniyor...");
  await runNode([npm, "run", "build"]);
  console.log(
    "\nKurulum tamamlandi. Baslatmak icin: npm.cmd run local\nTerminalde yazan Magaza veya Yonetim adresini tarayicinizda acin.\nE-posta: demo@local.test. Ilk kurulumda belirlediginiz sifreyi kullanin.",
  );
}
main().catch((error) => {
  console.error(`Kurulum durdu: ${error.message}`);
  process.exitCode = 1;
});
