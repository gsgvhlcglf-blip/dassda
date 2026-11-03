import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone">
      <span className="wordmark">KUZMIN</span>
      <p className="eyebrow">404</p>
      <h1>Bu yol henüz yok.</h1>
      <p>Aradığınız sayfa bulunamadı. / Page not found.</p>
      <Link className="button" href="/">
        Ana sayfaya dön ↗
      </Link>
    </main>
  );
}
