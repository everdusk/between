/** True when this page is open inside the MAX app, even before the launch string is signed. */
export function insideMaxApp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.hash.includes("WebAppData=")) return true;
  const app = (window as unknown as { WebApp?: { initData?: unknown; platform?: unknown } }).WebApp;
  return Boolean(app && (typeof app.initData === "string" || typeof app.platform === "string"));
}

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
