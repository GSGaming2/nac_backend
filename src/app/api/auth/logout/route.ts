import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ status: "ok" });
  res.cookies.set("auth_token", "", { path: "/", maxAge: 0 });
  return res;
}