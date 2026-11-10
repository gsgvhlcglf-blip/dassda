const dateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Istanbul",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
export function orderReferenceDay(at = new Date()) {
  const parts = Object.fromEntries(
    dateFormat.formatToParts(at).map((part) => [part.type, part.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    prefix: `${parts.day}${parts.month}${parts.year.slice(-2)}`,
  };
}
export function formatOrderReference(sequence: number, at = new Date()) {
  if (!Number.isSafeInteger(sequence) || sequence < 1)
    throw Error("Sipariş sırası geçersiz.");
  return `#${orderReferenceDay(at).prefix}${sequence}`;
}
export function orderReferenceSequence(reference: string, at: Date) {
  const prefix = "#" + orderReferenceDay(at).prefix;
  if (!reference.startsWith(prefix)) return 0;
  const tail = reference.slice(prefix.length),
    sequence = Number(tail);
  return /^[1-9][0-9]*$/.test(tail) && Number.isSafeInteger(sequence)
    ? sequence
    : 0;
}
export function dailyOrderCounters(
  orders: { reference: string; created_at: string }[],
) {
  const result = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const order of orders) {
    const at = new Date(order.created_at);
    if (!Number.isFinite(at.getTime())) continue;
    const { day } = orderReferenceDay(at),
      count = (counts.get(day) || 0) + 1;
    counts.set(day, count);
    result.set(
      day,
      Math.max(
        result.get(day) || 0,
        count,
        orderReferenceSequence(order.reference, at),
      ),
    );
  }
  return result;
}
