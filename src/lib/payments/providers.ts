import { z } from "zod";
import {
  amountString,
  minorUnits,
  paytrToken,
  paytrCallbackSignature,
  iyzicoAuthorization,
  iyzicoSignature,
  sameSignature,
  safeCheckoutURL,
} from "./protocol";
import type { PaymentAttempt, PaymentOrder, BuyerDetails } from "./types";
export type Credentials = {
  paytr?: { id: string; key: string; salt: string };
  iyzico?: { key: string; secret: string };
};
export class GatewayError extends Error {
  constructor(
    public code: string,
    public ambiguous = false,
  ) {
    super(code);
  }
}
async function responseJSON(response: Response) {
  if (!response.ok) throw new GatewayError("GATEWAY_UNAVAILABLE", true);
  try {
    return await response.json();
  } catch {
    throw new GatewayError("INVALID_GATEWAY_RESPONSE", true);
  }
}
export async function initializeGateway(
  attempt: PaymentAttempt,
  order: PaymentOrder,
  buyer: BuyerDetails,
  origin: string,
  credentials: Credentials,
  transport: typeof fetch = fetch,
) {
  if (attempt.provider === "paytr") {
    const c = credentials.paytr;
    if (!c) throw new GatewayError("MISSING_CREDENTIALS");
    const basket = Buffer.from(
      JSON.stringify(
        order.items.map((i) => [
          i.title,
          amountString(minorUnits(i.unit_price)),
          i.quantity,
        ]),
      ),
    ).toString("base64");
    const fields = new URLSearchParams({
      merchant_id: c.id,
      user_ip: buyer.ip,
      merchant_oid: attempt.merchant_ref,
      email: order.email,
      payment_amount: String(attempt.amount_minor),
      user_basket: basket,
      no_installment: "1",
      max_installment: "0",
      currency: "TL",
      test_mode: attempt.mode === "test" ? "1" : "0",
      user_name: order.customer_name,
      user_address: order.address,
      user_phone: order.phone,
      merchant_ok_url: origin + "/odeme/donus?attempt=" + attempt.id,
      merchant_fail_url: origin + "/odeme/donus?attempt=" + attempt.id,
      timeout_limit: "30",
      debug_on: "0",
      lang: "tr",
      paytr_token: paytrToken(
        {
          merchantId: c.id,
          ip: buyer.ip,
          merchantRef: attempt.merchant_ref,
          email: order.email,
          amountMinor: attempt.amount_minor,
          basket,
          test: attempt.mode === "test",
        },
        c.key,
        c.salt,
      ),
    });
    let data;
    try {
      data = await responseJSON(
        await transport("https://www.paytr.com/odeme/api/get-token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: fields.toString(),
          signal: AbortSignal.timeout(15000),
        }),
      );
    } catch (error) {
      throw error instanceof GatewayError
        ? error
        : new GatewayError("GATEWAY_UNAVAILABLE", true);
    }
    if (data.status !== "success") throw new GatewayError("GATEWAY_REJECTED");
    const token = z
      .string()
      .regex(/^[a-zA-Z0-9_-]{10,256}$/)
      .parse(data.token);
    return {
      token,
      url: safeCheckoutURL(
        "paytr",
        attempt.mode,
        "https://www.paytr.com/odeme/guvenli/" + token,
      ),
    };
  }
  const c = credentials.iyzico;
  if (!c) throw new GatewayError("MISSING_CREDENTIALS");
  const name = order.customer_name.trim().split(/\s+/),
    surname = name.pop();
  if (
    !surname ||
    !name.length ||
    !buyer.city ||
    !buyer.country ||
    !buyer.identity
  )
    throw new GatewayError("BUYER_DETAILS_REQUIRED");
  const address = {
    contactName: order.customer_name,
    city: buyer.city,
    country: buyer.country,
    address: order.address,
  };
  const payload = {
    locale: "tr",
    conversationId: attempt.id,
    price: amountString(attempt.amount_minor),
    paidPrice: amountString(attempt.amount_minor),
    currency: "TRY",
    basketId: attempt.merchant_ref,
    paymentGroup: "PRODUCT",
    callbackUrl: origin + "/api/payments/iyzico/callback?attempt=" + attempt.id,
    enabledInstallments: [1],
    forceThreeDS: 1,
    buyer: {
      id: attempt.customer_id,
      name: name.join(" "),
      surname,
      gsmNumber: order.phone,
      email: order.email,
      identityNumber: buyer.identity,
      registrationAddress: order.address,
      ip: buyer.ip,
      city: buyer.city,
      country: buyer.country,
    },
    shippingAddress: address,
    billingAddress: address,
    basketItems: order.items.map((i) => ({
      id: i.variant_id,
      name: i.title,
      category1: "Motosiklet parçaları",
      itemType: "PHYSICAL",
      price: amountString(minorUnits(i.unit_price) * i.quantity),
    })),
  };
  const data = await iyzicoRequest(
    "/payment/iyzipos/checkoutform/initialize/auth/ecom",
    payload,
    attempt.mode,
    c,
    transport,
  );
  if (data.status !== "success") throw new GatewayError("GATEWAY_REJECTED");
  const token = z.string().min(10).max(256).parse(data.token);
  if (
    data.conversationId !== attempt.id ||
    !sameSignature(
      String(data.signature || ""),
      iyzicoSignature([data.conversationId, token], c.secret),
    )
  )
    throw new GatewayError("INVALID_SIGNATURE", true);
  return {
    token,
    url: safeCheckoutURL(
      "iyzico",
      attempt.mode,
      z.string().parse(data.paymentPageUrl),
    ),
  };
}
async function iyzicoRequest(
  path: string,
  value: unknown,
  mode: "test" | "live",
  credentials: { key: string; secret: string },
  transport: typeof fetch,
) {
  const body = JSON.stringify(value),
    auth = iyzicoAuthorization(path, body, credentials.key, credentials.secret);
  try {
    return await responseJSON(
      await transport(
        (mode === "test"
          ? "https://sandbox-api.iyzipay.com"
          : "https://api.iyzipay.com") + path,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: auth.authorization,
            "x-iyzi-rnd": auth.nonce,
          },
          body,
          signal: AbortSignal.timeout(15000),
        },
      ),
    );
  } catch (error) {
    throw error instanceof GatewayError
      ? error
      : new GatewayError("GATEWAY_UNAVAILABLE", true);
  }
}
export function verifyPaytrCallback(
  fields: Record<string, string>,
  attempt: PaymentAttempt,
  credentials: NonNullable<Credentials["paytr"]>,
) {
  if (
    fields.merchant_oid !== attempt.merchant_ref ||
    !["success", "failed"].includes(fields.status) ||
    !/^\d{1,14}$/.test(fields.total_amount) ||
    !sameSignature(
      fields.hash || "",
      paytrCallbackSignature(
        fields.merchant_oid,
        fields.status,
        fields.total_amount,
        credentials.key,
        credentials.salt,
      ),
    )
  )
    throw Error("INVALID_SIGNATURE");
  const paid = fields.status === "success";
  return {
    paid,
    amount: Number(fields.total_amount),
    currency:
      fields.currency && fields.currency !== "TL" && fields.currency !== "TRY"
        ? "INVALID"
        : "TRY",
    paymentId: attempt.merchant_ref,
    review:
      fields.test_mode !== undefined &&
      fields.test_mode !== (attempt.mode === "test" ? "1" : "0"),
  };
}
export async function retrieveIyzico(
  attempt: PaymentAttempt,
  token: string,
  credentials: NonNullable<Credentials["iyzico"]>,
  transport: typeof fetch = fetch,
) {
  if (!attempt.token || !sameSignature(token, attempt.token))
    throw Error("TOKEN_MISMATCH");
  const data = await iyzicoRequest(
    "/payment/iyzipos/checkoutform/auth/ecom/detail",
    { locale: "tr", conversationId: attempt.id, token },
    attempt.mode,
    credentials,
    transport,
  );
  if (data.status !== "success")
    throw new GatewayError("RESULT_NOT_AVAILABLE", true);
  if (
    !sameSignature(
      String(data.signature || ""),
      iyzicoSignature(
        [
          data.paymentStatus,
          data.paymentId,
          data.currency,
          data.basketId,
          data.conversationId,
          data.paidPrice,
          data.price,
          data.token,
        ],
        credentials.secret,
      ),
    )
  )
    throw Error("INVALID_SIGNATURE");
  if (
    data.token !== token ||
    data.basketId !== attempt.merchant_ref ||
    data.conversationId !== attempt.id
  )
    throw Error("PAYMENT_MISMATCH");
  const paid = data.paymentStatus === "SUCCESS";
  if (!paid && !["FAILURE", "FAILED"].includes(data.paymentStatus))
    throw new GatewayError("RESULT_PENDING", true);
  return {
    paid,
    amount: minorUnits(data.paidPrice),
    currency: String(data.currency),
    paymentId: String(data.paymentId),
    review:
      minorUnits(data.price) !== attempt.amount_minor ||
      Number(data.fraudStatus) !== 1,
  };
}
