/** Country from the host in front of the app. Vercel sends the first header. */
export function countryFromHeaders(get: (name: string) => string | null): string | null {
  const raw = get("x-vercel-ip-country") ?? get("cf-ipcountry");
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/** Telegram does not open on a Russian address without a VPN. */
export function telegramNeedsVpn(country: string | null): boolean {
  return country === "RU";
}
