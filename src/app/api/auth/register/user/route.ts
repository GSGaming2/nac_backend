import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@/generated/client-postgres/client"; // type only (ok if schemas identical)
import { signAuthToken } from "@/app/lib/auth";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.string().default("user"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, role } = RegisterSchema.parse(body);

    const normalizedEmail = email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email: normalizedEmail, passwordHash, role },
      select: { id: true, email: true, role: true },
    });

    const token = await signAuthToken({
      sub: String(user.id),
      type: "user",
      email: user.email,
      role: user.role as "user" | "admin",
    });

    const res = NextResponse.json(
      { status: "ok", user },
      { status: 201 }
    );

    // Route Handlers can set cookies before response streaming. <!--citation:3-->
    res.cookies.set("auth_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err: any) {
    // Prisma unique constraint (email already exists)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { status: "error", message: "Email already registered" },
        { status: 409 }
      );
    }

    // Zod validation error
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