import { NextRequest } from "next/server";

const API_BASE = "https://api.namehunt.tech";
const INTERNAL_SECRET = process.env.INTERNAL_EDGE_SECRET!; 

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain")?.trim();
  const timeoutMs = searchParams.get("timeoutMs") ?? "180000";
  const providers = searchParams.get("providers") ?? "";

  if (!domain) {
    return new Response("Missing domain", { status: 400 });
  }
  // Optional: validate domain again on server

  const upstreamUrl = `${API_BASE}/search/stream?domain=${encodeURIComponent(
    domain
  )}&timeoutMs=${encodeURIComponent(timeoutMs)}&providers=${encodeURIComponent(
    providers
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
      "Content-Type": upstream.headers.get("Content-Type") || "application/json",
      // Add caching headers only if appropriate
    },
  });
}