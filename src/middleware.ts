import { NextRequest, NextResponse } from "next/server";

// Protect the /api/extract endpoint with an optional API key.
// Set EXTRACT_API_KEY in your Vercel environment variables to enable.
// If not set, the endpoint remains open (backwards compatible).

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/extract")) {
    const apiKey = process.env.EXTRACT_API_KEY;
    if (apiKey) {
      const provided =
        req.headers.get("x-api-key") ||
        req.nextUrl.searchParams.get("api_key");
      if (provided !== apiKey) {
        return NextResponse.json(
          { error: "Unauthorized. Valid API key required." },
          { status: 401 }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/extract"],
};
