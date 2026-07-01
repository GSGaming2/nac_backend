import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/app/lib/auth/requireAuth";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany();

    return NextResponse.json(users);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: "error", message: error.message }, { status: error.status });
    }
    return NextResponse.json({ status: "error", message: "Server error" }, { status: 500 });
  }
}