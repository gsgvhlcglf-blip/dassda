import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { readSecret } from "../scripts/read-secret.mjs";
class FakeTTY extends PassThrough {
  isTTY = true;
  isRaw = false;
  setRawMode(raw: boolean) {
    this.isRaw = raw;
    return this;
  }
}
test("password input is not echoed and normal terminal mode is restored", async () => {
  const input = new FakeTTY(),
    output = new PassThrough();
  let rendered = "";
  output.on("data", (chunk) => (rendered += chunk.toString()));
  try {
    const pending = readSecret("Password: ", {
      input: input as unknown as typeof process.stdin,
      output: output as unknown as typeof process.stdout,
    });
    input.emit("keypress", "Ü", {});
    input.emit("keypress", "x", {});
    input.emit("keypress", "", { name: "backspace" });
    input.emit("keypress", "e", {});
    input.emit("keypress", "", { name: "return" });
    assert.equal(await pending, "Üe");
    assert.equal(rendered, "Password: \n");
    assert.equal(input.isRaw, false);
  } finally {
    input.destroy();
    output.destroy();
  }
});
test("cancellation restores terminal mode and refuses non-interactive password input", async () => {
  const input = new FakeTTY(),
    output = new PassThrough();
  try {
    const pending = readSecret("Password: ", {
      input: input as unknown as typeof process.stdin,
      output: output as unknown as typeof process.stdout,
    });
    input.emit("keypress", "", { ctrl: true, name: "c" });
    await assert.rejects(pending, /iptal/);
    assert.equal(input.isRaw, false);
    const plain = new PassThrough();
    assert.throws(
      () =>
        readSecret("Password: ", {
          input: plain as unknown as typeof process.stdin,
          output: output as unknown as typeof process.stdout,
        }),
      /terminal/,
    );
    plain.destroy();
  } finally {
    input.destroy();
    output.destroy();
  }
});
