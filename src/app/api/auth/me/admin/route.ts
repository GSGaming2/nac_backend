import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/requireAuth";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany();

    return NextResponse.json(users);
  } catch (e: any) {
    if (e.message === "NOT_AUTHENTICATED")
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN")
      return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
    return NextResponse.json({ status: "error", message: "Server error" }, { status: 500 });
  }
}