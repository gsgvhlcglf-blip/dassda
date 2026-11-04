"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-store";
import { money } from "@/lib/i18n";
import { paymentStateLabel, type PaymentState } from "@/lib/payments/types";
type Receipt = {
  id: string;
  reference: string;
  state: PaymentState;
  mode: "test" | "live";
  provider: "paytr" | "iyzico";
  amountMinor: number;
  checkoutUrl: string | null;
};
export function PaymentResult({
  id,
  customerId,
}: {
  id: string;
  customerId: string;
}) {
  const [data, setData] = useState<Receipt | null>(null),
    [error, setError] = useState(""),
    [checking, setChecking] = useState(false);
  const [cart, setCart] = useCart();
  const done = useRef(false);
  async function refresh() {
    setChecking(true);
    try {
      const r = await fetch(
          "/api/payments/status?id=" + encodeURIComponent(id),
          { cache: "no-store" },
        ),
        value = await r.json();
      if (!r.ok) throw Error(value.error);
      setData(value);
      done.current = [
        "paid",
        "test_paid",
        "failed",
        "expired",
        "review",
      ].includes(value.state);
      setError("");
    } catch {
      setError(
        "Ödeme sonucu şu anda kontrol edilemedi. Yeniden sorgulayabilirsiniz.",
      );
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    done.current = false;
    void refresh();
    let count = 0;
    const timer = setInterval(() => {
      count++;
      if (count <= 24 && !done.current) void refresh();
      else clearInterval(timer);
    }, 2500);
    return () => clearInterval(timer);
  }, [id]);
  useEffect(() => {
    if (!data || data.id !== id) return;
    try {
      const key = "kz.pendingPayment." + customerId,
        pending = JSON.parse(sessionStorage.getItem(key) || "null");
      if (pending?.id !== id) return;
      if (["paid", "test_paid"].includes(data.state)) {
        if (pending.cart === JSON.stringify(cart)) setCart([]);
        sessionStorage.removeItem(key);
      }
      if (["failed", "expired"].includes(data.state))
        sessionStorage.removeItem(key);
    } catch {}
  }, [data?.state, customerId, id]);

  return (
    <section className="page-section payment-result">
      <p className="eyebrow">KUZMIN / ÖDEME DURUMU</p>
      <h1>
        {data
          ? paymentStateLabel[data.state]
          : "Ödeme sonucu kontrol ediliyor."}
      </h1>
      {data && (
        <>
          <p className="reference">{data.reference}</p>
          <p>{money(data.amountMinor / 100)}</p>
          {data.state === "paid" ? (
            <p>
              Ödemeniz sağlayıcı üzerinden doğrulandı. Siparişinizi hesabınızdan
              takip edebilirsiniz.
            </p>
          ) : data.state === "test_paid" ? (
            <p>
              Bu bir test işlemidir. Gerçek tahsilat ve canlı sipariş
              oluşturulmadı.
            </p>
          ) : data.state === "review" ? (
            <p>
              Ödeme inceleme gerektiriyor. Tekrar ödeme yapmayın; sipariş
              referansınızla bizimle iletişime geçin.
            </p>
          ) : ["failed", "expired"].includes(data.state) ? (
            <p>Ödeme tamamlanmadı. Sepetinizden yeniden deneyebilirsiniz.</p>
          ) : (
            <p>
              Sağlayıcıdan doğrulama bekleniyor. Bu ekran tek başına başarılı
              ödeme anlamına gelmez.
            </p>
          )}
          <div className="actions">
            {data.state === "ready" && data.checkoutUrl && (
              <a
                className="button"
                href={
                  data.provider === "paytr"
                    ? "/odeme?attempt=" + id
                    : data.checkoutUrl
                }
              >
                Ödemeye devam et
              </a>
            )}
            {["failed", "expired"].includes(data.state) && (
              <Link className="button" href="/odeme">
                Yeniden dene
              </Link>
            )}
            <Link className="button outline" href="/hesabim">
              Hesabım
            </Link>
            <Link className="under-link" href="/iletisim">
              İletişim
            </Link>
          </div>
        </>
      )}
      {error && !data && (
        <Link className="under-link" href="/sepet">
          Sepete dön →
        </Link>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button
        className="button outline"
        disabled={checking}
        onClick={() => void refresh()}
      >
        {checking ? "Kontrol ediliyor…" : "Durumu yenile"}
      </button>
    </section>
  );
}
export function PaymentReturnBridge({ id }: { id: string }) {
  useEffect(() => {
    if (parent === window) location.replace("/odeme/sonuc?attempt=" + id);
    else parent.postMessage({ type: "kz-payment-return", id }, location.origin);
  }, [id]);
  return (
    <main className="standalone">
      <h1>Ödeme sonucu kontrol ediliyor.</h1>
      <p>Doğrulanan sonucu görmek için mağazaya dönün.</p>
      <a className="button" href={"/odeme/sonuc?attempt=" + id} target="_top">
        Mağazaya dön
      </a>
    </main>
  );
}
