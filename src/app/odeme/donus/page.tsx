import { z } from "zod";
import { notFound } from "next/navigation";
import { PaymentReturnBridge } from "@/components/payment-result";
export const metadata = {
  title: "Mağazaya dön",
  robots: { index: false, follow: false },
};
export default async function Return({
  searchParams,
}: {
  searchParams: Promise<{ attempt?: string }>;
}) {
  const id = z.uuid().safeParse((await searchParams).attempt);
  if (!id.success) notFound();
  return <PaymentReturnBridge id={id.data} />;
}
