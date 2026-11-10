export const invoiceLimit = 4 * 1024 * 1024;
export function validateInvoice(bytes: Uint8Array, name: string, type: string) {
  if (!bytes.length || bytes.length > invoiceLimit)
    throw Error("Fatura en fazla 4 MB olmalıdır.");
  if (!/\.pdf$/i.test(name) || (type && type !== "application/pdf"))
    throw Error("Faturayı PDF olarak yükleyin.");
  const head = new TextDecoder().decode(bytes.slice(0, 8));
  const tail = new TextDecoder().decode(bytes.slice(-2048));
  if (!/^%PDF-(?:1\.[0-9]|2\.0)/.test(head) || !/%%EOF\s*$/.test(tail))
    throw Error("Geçerli bir PDF dosyası seçin.");
  return Array.from(
    name.normalize("NFC").replace(/[\x00-\x1f\x7f/\\"<>]/g, "_"),
  )
    .slice(-140)
    .join("");
}

/** Generated demonstration document only; never an issued fiscal invoice. */
export function exampleInvoicePDF() {
  const content = "BT /F1 16 Tf 45 760 Td (DEMO INVOICE - NOT VALID) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f\r\n${offsets
    .slice(1)
    .map((o) => String(o).padStart(10, "0") + " 00000 n\r\n")
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
