import { z } from "zod";
import { notFound } from "next/navigation";
import { PaymentResult } from "@/components/payment-result";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Ödeme durumu",
  robots: { index: false, follow: false },
};
export default async function Result({
  searchParams,
}: {
  searchParams: Promise<{ attempt?: string }>;
}) {
  const id = z.uuid().safeParse((await searchParams).attempt);
  if (!id.success) notFound();
  return <PaymentResult key={id.data} id={id.data} customerId="guest" />;
}
