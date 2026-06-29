import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@/generated/client-mysql/client";
import { signAuthToken } from "@/app/lib/auth/auth";

const AdminRegisterSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.string().default("admin"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, email, password, role } = AdminRegisterSchema.parse(body);

    const normalizedEmail = email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await prisma.admin.create({
      data: {
        username,
        email: normalizedEmail,
        passwordHash,
        role: role as "admin",
      },
      select: { id: true, email: true, username: true, role: true },
    });

    const token = await signAuthToken({
      sub: String(admin.id),
      type: "admin",
      email: admin.email,
      role: admin.role,
    });

    const res = NextResponse.json(
      { status: "ok", admin },
      { status: 201 }
    );

    res.cookies.set("auth_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { status: "error", message: "Username or email already exists" },
        { status: 409 }
      );
    }

    if (err?.name === "ZodError") {
      return NextResponse.json(
        { status: "error", message: "Invalid input", details: err.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { status: "error", message: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}