import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuthToken } from "@/app/lib/auth";

export async function GET() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) {
    return NextResponse.json(
      { status: "error", message: "Not authenticated" },
      { status: 401 }
    );
  }

  try {
    const payload = await verifyAuthToken(token);

    return NextResponse.json({
      status: "ok",
      me: {
        id: payload.sub,
        type: payload.type,
        email: payload.email,
        role: payload.role,
        message: "User authenticated successfully",
      },
    });
  } catch {
    return NextResponse.json(
      { status: "error", message: "Invalid token" },
      { status: 401 }
    );
  }
}