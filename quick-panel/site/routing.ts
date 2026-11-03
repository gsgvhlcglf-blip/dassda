let navigate: (url: string) => void = () => {};
export function setNavigator(fn: (url: string) => void) {
  navigate = fn;
}
export function navigateTo(url: string) {
  if (new URL(url, "https://kuzmin.preview").pathname.startsWith("/admin")) {
    window.parent.postMessage(
      {
        type: "kz-site-info",
        message: "Yönetim işlemleri için panelin sol menüsünü kullanın.",
      },
      "*",
    );
    return;
  }
  navigate(url);
}
