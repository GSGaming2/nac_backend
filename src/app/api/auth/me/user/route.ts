import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/app/lib/auth/auth";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      {
        status: "error",
        message: "Not authenticated",
      },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7);

  try {
    const payload = await verifyAuthToken(token);

    return NextResponse.json({
      status: "ok",
      user: {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        type: payload.type,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        status: "error",
        message: "Invalid token",
      },
      { status: 401 }
    );
  }
}