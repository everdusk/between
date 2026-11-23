import { userAgent } from "next/server";

export type FunnelDevice = "web" | "mobile" | "unknown";

export function funnelDevice(req: Request): FunnelDevice {
  const { browser, device, isBot } = userAgent(req);
  if (isBot) return "unknown";
  if (device.type === "mobile" || device.type === "tablet" ||
      req.headers.get("sec-ch-ua-mobile") === "?1" ||
      req.headers.get("x-between-ipados") === "1") return "mobile";
  return browser.name && !device.type ? "web" : "unknown";
}
