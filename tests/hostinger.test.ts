import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import nodemailer from "nodemailer";
import {
  smtpSettings,
  smtpFailure,
  mailReadiness,
} from "../src/server/mail/config";
import {
  localDemoAllowed,
  assertAdapterAvailable,
} from "../src/server/persistence/config";
import { renderOrderEmail, emailExampleOrder } from "../src/lib/email-design";
import { packageHostinger } from "../scripts/package-hostinger.mjs";

test("Hostinger configuration never claims a MySQL connection or exposes the local demonstration", () => {
  const env = {
    DEPLOYMENT_TARGET: "hostinger",
    NODE_ENV: "production",
    ALLOW_LOCAL_DEMO: "true",
    DATA_PROVIDER: "sqlite-demo",
  };
  assert.equal(localDemoAllowed(env), false);
  assert.throws(() => assertAdapterAvailable(env), /LOCAL_DEMO_DISABLED/);
  assert.throws(
    () => assertAdapterAvailable({ ...env, DATA_PROVIDER: "mysql" }),
    /MYSQL_ADAPTER_NOT_CONFIGURED/,
  );
  assert.equal(
    mailReadiness({ EMAIL_PROVIDER: "smtp" }, "sales@example.test").ready,
    false,
  );
  const smtp = {
    EMAIL_PROVIDER: "smtp",
    SMTP_HOST: "mail.example.test",
    SMTP_PORT: "465",
    SMTP_USER: "sales@example.test",
    SMTP_PASSWORD: "TEST-ONLY-NOT-A-CREDENTIAL",
  };
  assert(mailReadiness(smtp, "sales@example.test").ready);
  assert(!smtpSettings({ ...smtp, SMTP_PORT: "25" }));
  assert(!smtpSettings({ ...smtp, SMTP_HOST: "smtp://mail.example.test" }));
  assert.equal(smtpFailure({ responseCode: 451 }), "EMAIL_TEMPORARY_FAILURE");
  assert.equal(smtpFailure({ code: "EAUTH" }), "EMAIL_CONFIGURATION_REJECTED");
  assert.equal(
    smtpFailure({ code: "ETIMEDOUT", command: "DATA" }),
    "EMAIL_SMTP_RESULT_UNKNOWN",
  );
});

test("SMTP enforces TLS, creates a stable Message-ID and delivers the same HTML/PDF through MIME", async () => {
  const hook = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === "server-only")
        return {
          url: pathToFileURL(
            path.resolve(
              "node_modules/next/dist/compiled/server-only/empty.js",
            ),
          ).href,
          shortCircuit: true,
        };
      return next(specifier, context);
    },
  });
  const { sendSMTPEmail, smtpOptions } =
    await import("../src/server/mail/smtp");
  const { privateStorageRoot } = await import("../src/server/private-storage");
  hook.deregister();
  const settings = {
    host: "mail.example.test",
    port: 465 as const,
    user: "sales@example.test",
    password: "TEST-ONLY-NOT-A-CREDENTIAL",
  };
  assert.equal(smtpOptions(settings).secure, true);
  assert.equal(smtpOptions(settings).tls!.rejectUnauthorized, true);
  const starttls = smtpOptions({ ...settings, port: 587 });
  assert.equal(starttls.secure, false);
  assert.equal(starttls.requireTLS, true);
  assert.equal(smtpOptions(settings).disableFileAccess, true);
  assert.equal(smtpOptions(settings).disableUrlAccess, true);
  const messages: string[] = [],
    options: unknown[] = [];
  const fixtureFactory = ((config: unknown) => {
    options.push(config);
    const stream = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: "unix",
    });
    return {
      close: () => stream.close(),
      async sendMail(message: any) {
        const result = await stream.sendMail(message);
        messages.push(result.message.toString());
        return { ...result, accepted: [message.to], rejected: [] };
      },
    };
  }) as unknown as typeof nodemailer.createTransport;
  const mail = {
    ...renderOrderEmail("order_confirmed", emailExampleOrder()),
    from: "sales@example.test",
    provider: "smtp" as const,
  };
  const attachment = {
    filename: "fixture-invoice.pdf",
    content: Buffer.from("TEST-PDF-CONTENT").toString("base64"),
  };
  const first = await sendSMTPEmail(
    "test-order-notice",
    mail,
    attachment,
    settings,
    fixtureFactory,
  );
  const second = await sendSMTPEmail(
    "test-order-notice",
    mail,
    attachment,
    settings,
    fixtureFactory,
  );
  assert.equal(first, second);
  assert(messages[0].includes("application/pdf"));
  assert(messages[0].includes("text/html"));
  assert(messages[0].includes(attachment.content));
  assert(messages[0].includes("To: ornek@example.test"));
  assert(messages[0].includes("From: sales@example.test"));
  const failedFactory = (() => ({
    close() {},
    async sendMail() {
      throw {
        code: "ETIMEDOUT",
        command: "DATA",
        message: "private-provider-detail",
      };
    },
  })) as unknown as typeof nodemailer.createTransport;
  await assert.rejects(
    sendSMTPEmail(
      "test-order-notice",
      mail,
      attachment,
      settings,
      failedFactory,
    ),
    /^Error: EMAIL_SMTP_RESULT_UNKNOWN$/,
  );
  assert.equal(
    privateStorageRoot({}, "/tmp/kuzmin-app"),
    "/tmp/kuzmin-app/.data",
  );
  assert.equal(
    privateStorageRoot(
      { PRIVATE_STORAGE_ROOT: "/tmp/kuzmin-private" },
      "/tmp/kuzmin-app",
    ),
    "/tmp/kuzmin-private",
  );
  assert.throws(
    () =>
      privateStorageRoot(
        { PRIVATE_STORAGE_ROOT: "/tmp/kuzmin-app/public/invoices" },
        "/tmp/kuzmin-app",
      ),
    /MUST_BE_PRIVATE/,
  );
  assert.throws(
    () =>
      privateStorageRoot(
        { PRIVATE_STORAGE_ROOT: "relative-data" },
        "/tmp/kuzmin-app",
      ),
    /MUST_BE_ABSOLUTE/,
  );
  assert.throws(
    () =>
      privateStorageRoot(
        { DEPLOYMENT_TARGET: "hostinger", NODE_ENV: "production" },
        "/tmp/kuzmin-app",
      ),
    /REQUIRED/,
  );
  assert.throws(
    () =>
      privateStorageRoot(
        {
          DEPLOYMENT_TARGET: "hostinger",
          NODE_ENV: "production",
          PRIVATE_STORAGE_ROOT: "/tmp/kuzmin-app/invoices",
        },
        "/tmp/kuzmin-app",
      ),
    /OUTSIDE_RELEASE/,
  );
});

test("Hostinger deployment bundle preserves assets but excludes env secrets and operational uploads", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "kuzmin-hostinger-"));
  try {
    for (const dir of [
      ".next/standalone/.data",
      ".next/static",
      "public/images",
      "public/uploads",
    ])
      await mkdir(path.join(root, dir), { recursive: true });
    await writeFile(
      path.join(root, ".next/standalone/server.js"),
      "// fixture server",
    );
    await writeFile(
      path.join(root, ".next/standalone/.env.local"),
      "TEST-PRIVATE-ENV",
    );
    await writeFile(
      path.join(root, ".next/standalone/.data/private-invoice.pdf"),
      "TEST-PRIVATE-PDF",
    );
    await writeFile(path.join(root, "private.env"), "TEST-PRIVATE-ALIAS");
    await symlink(
      path.join(root, ".next/standalone/.env.local"),
      path.join(root, ".next/standalone/alias-secret"),
    );
    await writeFile(path.join(root, ".next/static/site.js"), "fixture-static");
    await writeFile(path.join(root, "public/images/hero.svg"), "fixture-art");
    await writeFile(
      path.join(root, "public/uploads/customer.pdf"),
      "TEST-UPLOAD",
    );
    const output = await packageHostinger(root);
    assert.equal(
      await readFile(path.join(output, "public/images/hero.svg"), "utf8"),
      "fixture-art",
    );
    assert.equal(
      await readFile(path.join(output, ".next/static/site.js"), "utf8"),
      "fixture-static",
    );
    const files = await readdir(output, { recursive: true });
    assert(
      !files.some(
        (f) =>
          f.includes(".env") ||
          f.includes(".data") ||
          f.includes("uploads") ||
          f.includes("alias-secret"),
      ),
    );
    await packageHostinger(root); // Only a previously marked artifact directory may be replaced.
    await writeFile(
      path.join(output, ".hostinger-build.json"),
      '{"project":"different"}',
    );
    await assert.rejects(packageHostinger(root), /HOSTINGER_OUTPUT_NOT_OWNED/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
