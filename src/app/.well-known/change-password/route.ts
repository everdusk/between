import { NextResponse } from "next/server";

/** Chrome and other managers open this URL to find the change-password form. */
export function GET(req: Request) {
  const url = new URL("/journal", req.url);
  url.hash = "password";
  return NextResponse.redirect(url);
}
