import { checkRateLimit, INTERVAL } from "@/lib/ratelimit";
import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.namehunt.tech";
const INTERNAL_SECRET = process.env.INTERNAL_EDGE_SECRET!;

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
  const timeoutMs = searchParams.get("timeoutMs") ?? "180000";
  const providers = searchParams.get("providers") ?? "";
  const origin = req.headers.get("origin");
  if (origin && origin !== "https://namehunt.tech") {
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

  const upstream = await fetch(upstreamUrl, {
    method: "GET",
    headers: {
      "X-Internal-Secret": INTERNAL_SECRET,
    },
  });

  // Pass through status and stream body
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") || "application/json",
      // Add caching headers only if appropriate
    },
  });
}
