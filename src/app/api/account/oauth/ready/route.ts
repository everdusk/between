import { NextResponse } from "next/server";
import { OAUTH_PROVIDERS, oauthClient } from "@/lib/oauth";

/** Which browser sign-in buttons have keys. Names only, never the secrets. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    providers: OAUTH_PROVIDERS.filter((provider) => oauthClient(provider)),
  });
}
