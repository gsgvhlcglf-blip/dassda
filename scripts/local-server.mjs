import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  selectLocalPort,
  probeInstallation,
  openBrowser,
} from "./local-runtime.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
async function main() {
  if (Number(process.versions.node.split(".")[0]) < 24)
    throw new Error(
      "Node.js 24 veya yenisi gerekiyor. 1-KURULUM.cmd dosyasini calistirin.",
    );
  if (!existsSync(".env.local") || !existsSync(".next/BUILD_ID"))
    throw new Error(
      "Ilk kurulum tamamlanmamis. Once 1-KURULUM.cmd dosyasini calistirin.",
    );
  // A locally installed copy is deliberately independent of any hosting account.
  const config = readFileSync(".env.local", "utf8");
  if (
    config.split(/\r?\n/).some((line) => {
      const match = line.match(
        /^(?:NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY)=(.*)$/,
      );
      const value = match?.[1].trim();
      return value && !['""', "''"].includes(value) && !value.startsWith("#");
    })
  )
    throw new Error(
      "Bu klasor Supabase icin ayarlanmis. Cevrimdisi paket icin temiz bir klasor kullanin.",
    );
  const { port, existing } = await selectLocalPort(
    root,
    Number(process.env.KUZMIN_LOCAL_PORT || 3000),
  );
  const base = `http://localhost:${port}`,
    target = base + (process.argv.includes("--admin") ? "/admin/ayarlar" : "");
  console.log(
    `Magaza: ${base}\nYonetim: ${base}/admin\nYapilandirma: ${base}/admin/ayarlar`,
  );
  if (existing) {
    console.log("Ayni klasordeki uygulama zaten acik.");
    if (!process.argv.includes("--no-browser")) openBrowser(target);
    return;
  }
  const child = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "production",
        ALLOW_LOCAL_DEMO: "true",
        NEXT_TELEMETRY_DISABLED: "1",
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
        NEXT_PUBLIC_SITE_URL: "",
        ENABLE_INDEXING: "false",
        VERCEL: "",
      },
    },
  );
  let exited = false;
  child.on("error", (e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    exited = true;
    process.exitCode = code ?? 1;
  });
  let stopping = false;
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      stopping = true;
      child.kill("SIGTERM");
    });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline && !exited && !stopping) {
    if (await probeInstallation(port, root)) {
      mkdirSync(".data", { recursive: true });
      writeFileSync(
        ".data/local-url.json",
        JSON.stringify({ url: base, port }),
      );
      console.log(
        "\nHazir. E-posta: demo@local.test. Kurulumda sectiginiz sifreyi kullanin.\nBu pencere acik kalmali. Durdurmak icin Ctrl+C kullanin.\nSonraki acilislarda internet gerekmez; veriler bu klasorde saklanir.",
      );
      if (!process.argv.includes("--no-browser")) openBrowser(target);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  if (!stopping) {
    child.kill("SIGTERM");
    throw new Error(
      "Uygulama hazir olmadi. Yukaridaki hata mesajini kontrol edin.",
    );
  }
}
main().catch((e) => {
  console.error(`\nBaslatilamadi: ${e.message}`);
  process.exitCode = 1;
});
