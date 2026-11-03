"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <span className="wordmark">KUZMIN</span>
      <h1>Bir bağlantı eksik.</h1>
      <p>
        Veriler yüklenemedi. Supabase yapılandırmasını ve bağlantıyı kontrol
        edin.
      </p>
      <button className="button" onClick={reset}>
        Tekrar dene / Retry
      </button>
    </main>
  );
}
