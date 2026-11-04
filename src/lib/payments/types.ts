export type PaymentProvider = "none" | "paytr" | "iyzico";
export type PaymentMode = "test" | "live";
export type PaymentState =
  | "creating"
  | "ready"
  | "unknown"
  | "paid"
  | "test_paid"
  | "failed"
  | "expired"
  | "review";
export type PaymentSettings = {
  provider: PaymentProvider;
  mode: PaymentMode;
  enabled: boolean;
};
export type PaymentAttempt = {
  id: string;
  order_id: string;
  customer_id: string;
  provider: Exclude<PaymentProvider, "none">;
  mode: PaymentMode;
  state: PaymentState;
  amount_minor: number;
  currency: "TRY";
  merchant_ref: string;
  token: string | null;
  checkout_url: string | null;
  provider_payment_id: string | null;
  reserved: boolean;
  created_at: string;
  expires_at: string;
  error_code: string | null;
};
export type PaymentOrder = {
  reference: string;
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  total: number;
  items: {
    title: string;
    quantity: number;
    unit_price: number;
    variant_id: string;
  }[];
};
export type BuyerDetails = {
  city?: string;
  country?: string;
  identity?: string;
  ip: string;
};
export type PaymentPublicConfig = {
  provider: PaymentProvider;
  mode: PaymentMode;
  enabled: boolean;
  ready: boolean;
};
export const paymentStateLabel: Record<PaymentState, string> = {
  creating: "Ödeme ekranı hazırlanıyor",
  ready: "Ödeme bekleniyor",
  unknown: "Sağlayıcı sonucu bekleniyor",
  paid: "Ödeme doğrulandı",
  test_paid: "Test ödemesi doğrulandı",
  failed: "Ödeme tamamlanamadı",
  expired: "Ödeme süresi doldu",
  review: "Ödeme inceleme gerektiriyor",
};

export function paymentStatusLabel(value: string) {
  return value === "pending"
    ? "Ödeme bekleniyor"
    : value === "request_only"
      ? "Ödeme alınmadı · sipariş talebi"
      : paymentStateLabel[value as PaymentState] || value;
}
