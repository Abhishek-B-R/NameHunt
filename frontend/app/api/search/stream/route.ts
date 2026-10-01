import { checkRateLimit, INTERVAL } from "@/lib/ratelimit";
import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.BACKEND_URL || "https://api.namehunt.abhishekbr.com";
const INTERNAL_SECRET = process.env.INTERNAL_EDGE_SECRET!;
const ALLOWED_ORIGINS = [
  "https://namehunt.abhishekbr.com",
  "https://namehunt.tech",
];

// Never cache/prerender a live stream. The backend caps every provider at 45s,
// so the whole stream fits inside a 60s function (the max on every Vercel plan).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const isLimited = await checkRateLimit(ip);
  if (isLimited) {
    return new NextResponse(
      JSON.stringify({ message: "Too Many Requests" }),
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(INTERVAL / 1000).toString(),
          "Content-Type": "application/json",
        },
      }
    );
  }

  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain")?.trim();
  const timeoutMs = searchParams.get("timeoutMs") ?? "45000";
  const providers = searchParams.get("providers") ?? "";
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!domain) {
    return new Response("Missing domain", { status: 400 });
  }
  // Optional: validate domain again on server

  const upstreamUrl = `${API_BASE}/search/stream?domain=${encodeURIComponent(
    domain,
  )}&timeoutMs=${encodeURIComponent(timeoutMs)}&providers=${encodeURIComponent(
    providers,
  )}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "X-Internal-Secret": INTERNAL_SECRET,
      },
      cache: "no-store",
      // stop the upstream stream when the visitor closes the tab
      signal: req.signal,
    });
  } catch {
    return new Response("Search service unavailable", { status: 502 });
  }

  // Pass through status and stream body
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") || "application/json",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
