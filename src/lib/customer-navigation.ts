export function safeNext(value: unknown) {
  return typeof value === "string" &&
    /^\/(?!\/|\\)/.test(value) &&
    !/[\x00-\x20\\]/.test(value) &&
    !value.startsWith("/admin") &&
    !value.startsWith("/api/")
    ? value
    : "/hesabim";
}
