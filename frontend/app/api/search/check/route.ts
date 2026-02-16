import { checkRateLimit } from "@/lib/ratelimit";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
    const ip =
        req.headers.get("x-forwarded-for") ||
        req.headers.get("x-real-ip") ||
        "unknown";

    if (await checkRateLimit(ip)) {
        return new Response(null, { status: 429 });
    }

    return new Response(null, { status: 200 });
}
