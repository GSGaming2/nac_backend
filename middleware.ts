import { NextRequest, NextResponse } from "next/server";

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
];

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const response =
    request.method === "OPTIONS"
      ? new NextResponse(null, { status: 204 })
      : NextResponse.next();

  const isAllowed =
    origin &&
    (
      allowedOrigins.includes(origin) ||
      origin.endsWith(".vibepreview.com")
    );

  if (isAllowed) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );

  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  response.headers.set("Vary", "Origin");

  return response;
}

export const config = {
  matcher: "/api/:path*",
};