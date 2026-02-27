import { NextRequest, NextResponse } from "next/server";

function getAllowedOrigins(): Set<string> {
  const raw = [
    process.env.CORS_ALLOWED_ORIGINS || "",
    process.env.NEXT_PUBLIC_EMERGENCY_BASE_URL || "",
    process.env.NEXT_PUBLIC_APP_URL || "",
  ]
    .join(",")
    .split(",")
    .map((v) => v.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  return new Set(raw);
}

function resolveAllowOrigin(request: NextRequest, allowedOrigins: Set<string>): string {
  const origin = request.headers.get("origin")?.trim().replace(/\/+$/, "") || "";
  if (!origin) return "*";
  if (allowedOrigins.size === 0) return "*";
  if (allowedOrigins.has(origin)) return origin;
  return "*";
}

function applyCorsHeaders(
  response: NextResponse,
  request: NextRequest,
  allowedOrigins: Set<string>
): NextResponse {
  const allowOrigin = resolveAllowOrigin(request, allowedOrigins);
  const requestedHeaders = request.headers.get("access-control-request-headers");

  response.headers.set("Access-Control-Allow-Origin", allowOrigin);
  response.headers.set("Vary", "Origin");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
  response.headers.set(
    "Access-Control-Allow-Headers",
    requestedHeaders || "Content-Type, Authorization, Range, User-Agent, X-Requested-With"
  );
  response.headers.set("Access-Control-Max-Age", "86400");

  return response;
}

export function middleware(request: NextRequest) {
  const allowedOrigins = getAllowedOrigins();

  if (request.method === "OPTIONS") {
    return applyCorsHeaders(new NextResponse(null, { status: 204 }), request, allowedOrigins);
  }

  return applyCorsHeaders(NextResponse.next(), request, allowedOrigins);
}

export const config = {
  matcher: ["/api/:path*"],
};
