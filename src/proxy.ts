import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Marks the journal tab that MAX itself opened, so the page can stay in Russian. */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const requested = request.headers.get("x-requested-with") ?? "";
  const referer = request.headers.get("referer") ?? "";
  let fromMax = /oneme/i.test(requested);
  if (!fromMax && referer) {
    try {
      const host = new URL(referer).hostname;
      fromMax = host === "max.ru" || host.endsWith(".max.ru");
    } catch {
      fromMax = false;
    }
  }
  if (fromMax) {
    response.cookies.set("between-max", "1", {
      path: "/journal",
      sameSite: "lax",
      httpOnly: false,
    });
  }
  return response;
}

export const config = {
  matcher: "/journal",
};
