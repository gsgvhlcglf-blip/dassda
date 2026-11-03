import { emitKeypressEvents } from "node:readline";
/** Read a local password without echoing it or changing machine security settings. */
export function readSecret(
  prompt,
  { input = process.stdin, output = process.stdout } = {},
) {
  if (!input.isTTY || typeof input.setRawMode !== "function")
    throw new Error("Bu komutu normal bir terminal penceresinde calistirin.");
  return new Promise((resolve, reject) => {
    let value = "";
    const previous = Boolean(input.isRaw);
    emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    output.write(prompt);
    function finish() {
      input.removeListener("keypress", onKey);
      input.setRawMode(previous);
      input.pause();
      output.write("\n");
    }
    function onKey(text, key = {}) {
      if (key.ctrl && key.name === "c") {
        finish();
        reject(new Error("Kurulum iptal edildi."));
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        finish();
        resolve(value);
        return;
      }
      if (key.name === "backspace") {
        value = Array.from(value).slice(0, -1).join("");
        return;
      }
      if (
        !key.ctrl &&
        !key.meta &&
        text &&
        !/[\u0000-\u001f\u007f]/.test(text)
      ) {
        if (value.length + text.length > 128) {
          finish();
          reject(new Error("Sifre en fazla 128 karakter olabilir."));
          return;
        }
        value += text;
      }
    }
    input.on("keypress", onKey);
  });
}
