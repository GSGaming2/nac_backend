import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/app/lib/prisma";
import { signAuthToken } from "@/app/lib/auth";

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  type: z.enum(["user", "admin"]).default("user"),
});

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = LoginSchema.parse(body);

    const [user, admin] = await Promise.all([
    prisma.user.findUnique({
      where: { email },
    }),
    prisma.admin.findUnique({
      where: { email },
    }),
    ]);

    const account = admin ?? user;
    const userType = admin ? "admin" : "user";

    if (!account) {
      return NextResponse.json(
        {
          status: "error",
          message: "User not found",
        },
        { status: 401 }
      );
    }

    const passwordMatches = await bcrypt.compare(
      password,
      account.passwordHash
    );

    if (!passwordMatches) {
      return NextResponse.json(
        {
          status: "error",
          message: "Invalid credentials",
        },
        { status: 401 }
      );
    }

    const token = await signAuthToken({
      sub: String(account.id),
      type: userType,
      email: account.email,
      role: account.role as "user" | "admin",
    });

    const response = NextResponse.json({
      status: "ok",
      account: {
        id: account.id,
        email: account.email,
        role: account.role,
      },
    });

    response.cookies.set("auth_token", token, AUTH_COOKIE_OPTIONS);

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          status: "error",
          message: "Invalid request data",
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    console.error("Login Error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}