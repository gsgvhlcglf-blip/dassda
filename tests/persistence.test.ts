import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  dataProvider,
  localDemoAllowed,
  assertAdapterAvailable,
} from "../src/server/persistence/config";

test("provider choice is explicit and incomplete production configuration never falls back", () => {
  assert.equal(dataProvider({}), "sqlite-demo");
  assert.equal(localDemoAllowed({ NODE_ENV: "development" }), true);
  assert.equal(localDemoAllowed({ NODE_ENV: "production" }), false);
  assert.equal(
    localDemoAllowed({ NODE_ENV: "production", ALLOW_LOCAL_DEMO: "true" }),
    true,
  );
  assert.equal(
    localDemoAllowed({ VERCEL: "1", ALLOW_LOCAL_DEMO: "true" }),
    false,
  );
  assert.throws(
    () => assertAdapterAvailable({ NODE_ENV: "production" }),
    /LOCAL_DEMO_DISABLED/,
  );
  assert.throws(
    () => dataProvider({ DATA_PROVIDER: "misspelled" }),
    /DATA_PROVIDER_INVALID/,
  );
  assert.throws(
    () => dataProvider({ NEXT_PUBLIC_SUPABASE_URL: "https://example.test" }),
    /CONFIGURATION_INCOMPLETE/,
  );
  assert.throws(
    () => dataProvider({ DATA_PROVIDER: "supabase" }),
    /CONFIGURATION_INCOMPLETE/,
  );
  const configured = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.test",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key",
  };
  assert.equal(dataProvider(configured), "supabase");
  assert.equal(
    dataProvider({ ...configured, DATA_PROVIDER: "sqlite-demo" }),
    "sqlite-demo",
  );
  assert.throws(
    () =>
      assertAdapterAvailable({
        ...configured,
        DATA_PROVIDER: "mysql",
        NODE_ENV: "development",
      }),
    /MYSQL_ADAPTER_NOT_CONFIGURED/,
  );
});

const root = process.cwd();
function run(script: string, directory: string, provider = "sqlite-demo") {
  const setup = `
    import { registerHooks } from 'node:module';
    import { pathToFileURL } from 'node:url';
    import assert from 'node:assert/strict';
    const root = ${JSON.stringify(root)};
    registerHooks({ resolve(specifier, context, next) {
      return specifier === 'server-only'
        ? { url: pathToFileURL(root+'/node_modules/next/dist/compiled/server-only/empty.js').href, shortCircuit: true }
        : next(specifier, context);
    }});
    process.chdir(${JSON.stringify(directory)});
    const load = file => import(pathToFileURL(root+'/'+file).href);
  `;
  const result = spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      setup + script,
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 30000,
      env: {
        ...process.env,
        DATA_PROVIDER: provider,
        NODE_ENV: "production",
        ALLOW_LOCAL_DEMO: "true",
        VERCEL: "",
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test("server repositories retain published catalog, CRM, files and consistent insights across process restarts", () => {
  const directory = mkdtempSync(join(tmpdir(), "kuzmin-repositories-"));
  try {
    run(
      `
      const { getCatalog } = await load('src/lib/catalog.ts');
      const { getWorkspace, saveWorkspace, publishWorkspace } = await load('src/lib/site-version-store.ts');
      const requests = await load('src/lib/request-store.ts');
      const { publicRequestSchema, newWorkRequest, blankTerms } = await load('src/lib/requests.ts');
      const { writeFileSync } = await import('node:fs');
      const workspace = await getWorkspace();
      workspace.snapshot.catalog.products[0].title.tr = 'Kalıcı demo test ürünü';
      await saveWorkspace(workspace.revision, workspace.snapshot);
      await publishWorkspace(workspace.revision + 1);
      const catalog = await getCatalog();
      assert.equal(catalog.products[0].title.tr, 'Kalıcı demo test ürünü');
      const input = publicRequestSchema.parse({
        submission_key: crypto.randomUUID(), kind: 'custom',
        brand_name: 'Serbest marka', model_name: 'Serbest model', year: 2024,
        length_cm: 25, width_cm: 12, part_description: 'Yalnızca test başvurusu',
        material: 'twill', manufacturing_method: 'infusion',
        name: 'Demo', email: 'demo@example.test', phone: '+905550001122', permission: true,
      });
      const record = newWorkRequest(input, catalog, blankTerms, null);
      const photos = Array.from({length:3}, (_,i) => ({name:'test-'+i+'.png',mime:'image/png',extension:'png',bytes:Buffer.from('demo-photo-'+i)}));
      const files = await requests.storeWorkPhotos(record.id, photos, 'customer');
      const receipt = await requests.submitWork(record, files, 'test-source', 'test-fingerprint');
      const retried = await requests.submitWork(record, files, 'test-source', 'test-fingerprint');
      assert.deepEqual(retried, receipt);
      assert.equal((await requests.workInsights(0)).total, 1);
      assert.equal((await requests.workFiles(record.id)).length, 3);
      writeFileSync('receipt.json', JSON.stringify(receipt));
    `,
      directory,
    );
    run(
      `
      const { readFileSync } = await import('node:fs');
      const receipt = JSON.parse(readFileSync('receipt.json', 'utf8'));
      const { getCatalog } = await load('src/lib/catalog.ts');
      const requests = await load('src/lib/request-store.ts');
      const catalog = await getCatalog();
      assert.equal(catalog.products[0].title.tr, 'Kalıcı demo test ürünü');
      assert.equal((await requests.findWorkRequest(receipt.id)).reference, receipt.reference);
      const records = await requests.allWorkRequests();
      const insight = await requests.workInsights(0);
      assert.equal(records.length, 1); assert.equal(insight.total, records.length);
      assert.equal(insight.byBrand[0].name, 'Serbest marka');
      const files = await requests.workFiles(receipt.id);
      assert.equal(files.length, 3);
      assert.equal((await requests.localWorkPhoto(files[0].id)).bytes.toString(), 'demo-photo-0');
    `,
      directory,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("selecting unimplemented MySQL rejects all repositories and creates no local database", () => {
  const directory = mkdtempSync(join(tmpdir(), "kuzmin-mysql-guard-"));
  try {
    run(
      `
      const { repository } = await load('src/server/persistence/index.ts');
      for (const name of ['catalog','workspace','requests','analytics','payments','identity','orders','media'])
        await assert.rejects(repository(name), /MYSQL_ADAPTER_NOT_CONFIGURED/);
    `,
      directory,
      "mysql",
    );
    assert.equal(existsSync(join(directory, ".data")), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
