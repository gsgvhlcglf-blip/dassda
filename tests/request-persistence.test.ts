import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("lost commit responses recover a receipt, cleanup keeps linked files and readiness checks the private schema/bucket", () => {
  const script = `
    import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    import { pathToFileURL } from 'node:url';
    registerHooks({ resolve(specifier,context,next) { return specifier === 'server-only' ? { url: pathToFileURL(process.cwd()+'/node_modules/next/dist/compiled/server-only/empty.js').href, shortCircuit: true } : next(specifier,context); } });
    const { submitWork, discardUnlinkedWorkPhotos, workReadiness } = await import('./src/lib/request-store.ts');
    const { blankTerms } = await import('./src/lib/requests.ts');
    let failLookup = false, bucketPublic = false, schemaMissing = false, removed = [];
    const record = { id: 'record', input: { submission_key: 'key' } };
    const files = ['linked','new-a','new-b'].map(id => ({id,path:id+'.png'}));
    globalThis.fetch = async (input, init) => {
      const u = new URL(String(input));
      const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
      if(u.pathname.endsWith('/rpc/submit_work_request')) return json({message:'Commit response lost'},503);
      if(u.pathname.endsWith('/work_requests')) {
        if(u.searchParams.has('submission_key')) return json([{id:'record',reference:'KZ-OZ-RECOVERED',fingerprint:'digest'}]);
        return schemaMissing ? json({message:'missing columns'},400) : json([]);
      }
      if(u.pathname.endsWith('/work_request_files')) return failLookup ? json({message:'database unavailable'},503) : json([{id:'linked'}]);
      if(u.pathname.endsWith('/object/work-requests')) { removed.push(...JSON.parse(init.body).prefixes); return json([]); }
      if(u.pathname.endsWith('/work_terms_versions')) return json({body:blankTerms});
      if(u.pathname.endsWith('/bucket/work-requests')) return json({id:'work-requests',public:bucketPublic});
      throw Error('Unexpected mock endpoint: '+u.pathname);
    };
    const receipt = await submitWork(record, files, 'source', 'digest');
    assert.equal(receipt.reference,'KZ-OZ-RECOVERED');
    await discardUnlinkedWorkPhotos(files);
    assert.deepEqual(removed.sort(),['new-a.png','new-b.png']);
    removed=[];failLookup=true;
    await discardUnlinkedWorkPhotos(files);
    assert.deepEqual(removed,[]);
    await workReadiness();
    bucketPublic=true;await assert.rejects(workReadiness,/REQUEST_SETUP_REQUIRED/);
    bucketPublic=false;schemaMissing=true;await assert.rejects(workReadiness,/REQUEST_SETUP_REQUIRED/);
  `;
  const result = spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      script,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 15000,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.test",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon",
        SUPABASE_SERVICE_ROLE_KEY: "test-service",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});
