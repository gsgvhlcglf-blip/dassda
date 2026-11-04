function renderPaymentWorkspace(view) {
  let value = { provider: "none", mode: "test" };
  try {
    const saved = JSON.parse(
      localStorage.getItem(KEY + ".payment-plan") || "null",
    );
    if (
      saved &&
      ["none", "paytr", "iyzico"].includes(saved.provider) &&
      ["test", "live"].includes(saved.mode)
    )
      value = saved;
  } catch {}
  view.innerHTML = `<section class="box"><p class="eyebrow">ÖDEME ALTYAPISI</p><h2>PayTR veya iyzico.</h2><p class="muted">Canlı uygulamada sağlayıcı seçimi, güvenli ödeme ekranı ve doğrulanan ödeme sonuçları için altyapı hazırlandı. Bu tarayıcı paneli yalnızca tercihinizi saklar; ödeme başlatmaz ve mağaza anahtarı almaz.</p><form id="payment-plan-form"><div class="studio-photo-controls"><label>Planlanan sağlayıcı<select name="provider" aria-label="Planlanan ödeme sağlayıcısı">${studioPhotoOptions(
    [
      ["none", "Henüz seçilmedi"],
      ["paytr", "PayTR"],
      ["iyzico", "iyzico"],
    ],
    value.provider,
  )}</select></label><label>Planlanan çalışma modu<select name="mode" aria-label="Planlanan ödeme modu">${studioPhotoOptions(
    [
      ["test", "Test · gerçek tahsilat yok"],
      ["live", "Canlı · sunucu kurulumu gerekir"],
    ],
    value.mode,
  )}</select></label></div><button class="button" type="submit">Tercihi kaydet</button><p id="payment-plan-feedback" role="status"></p></form></section><section class="box" style="margin-top:20px"><h2>Kurulum bekliyor.</h2><p class="muted">Gerçek yönetim panelinde Ödeme altyapısı bölümünden sağlayıcı seçilir. Mağaza anahtarları sunucunun ortam değişkenlerine eklenir. HTTPS site adresi ve sağlayıcının dönüş/bildirim adresleri tamamlandığında test ödemesi denenir.</p><p>PayTR: mağaza numarası, anahtar ve salt.<br>iyzico: test ve canlı API anahtarları.</p><p class="help">Kart bilgileri sağlayıcı ekranında girilir. Ödeme; imza, sipariş ve tutar doğrulamasıyla kaydedilir. Yalnızca dönüş sayfasını açmak siparişi ödenmiş yapmaz. Bu tercih içerik sürümü geri almadan bağımsızdır.</p><a class="button secondary" target="_blank" rel="noopener" href="https://github.com/gsgvhlcglf-blip/dassda/blob/main/docs/ODEME.md">Kurulum kılavuzunu aç ↗</a></section>`;
}
document.addEventListener("submit", (event) => {
  if (event.target.id !== "payment-plan-form") return;
  event.preventDefault();
  try {
    const fields = new FormData(event.target),
      provider = String(fields.get("provider")),
      mode = String(fields.get("mode"));
    if (
      !["none", "paytr", "iyzico"].includes(provider) ||
      !["test", "live"].includes(mode)
    )
      throw Error("Seçim geçersiz.");
    localStorage.setItem(
      KEY + ".payment-plan",
      JSON.stringify({ provider, mode }),
    );
    $("#payment-plan-feedback").textContent =
      "Tercih bu tarayıcıya kaydedildi. Canlı ödeme bağlantısı henüz açık değil.";
  } catch (error) {
    $("#payment-plan-feedback").textContent = error.message;
  }
});
