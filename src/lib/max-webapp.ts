/** Signed launch string from a MAX mini app, or null in a normal browser. */
export function readMaxInitData(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (hash) {
    const data = new URLSearchParams(hash).get("WebAppData");
    if (data) return data;
  }
  const app = (window as unknown as { WebApp?: { initData?: string } }).WebApp;
  const init = app?.initData?.trim();
  return init || null;
}
