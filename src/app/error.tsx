"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <span className="wordmark">KUZMIN</span>
      <h1>Sayfa şu anda yüklenemiyor.</h1>
      <p>Lütfen biraz sonra tekrar deneyin.</p>
      <button className="button" onClick={reset}>
        Tekrar dene / Retry
      </button>
    </main>
  );
}
