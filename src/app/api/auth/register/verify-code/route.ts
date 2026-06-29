import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/app/lib/prisma";
import { signAuthToken } from "@/app/lib/auth/auth";

const VerifySchema = z.object({
  email: z.string().email(),
  code: z.string().trim().min(4).max(10),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, code } = VerifySchema.parse(body);
    const normalizedEmail = email.toLowerCase().trim();

    const pending = await prisma.pendingRegistration.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!pending) return NextResponse.json({
      status: "error",
      message: "Registration not found",
    },{ status: 404 });
    

    if (pending.status !== "CODE_SENT") return NextResponse.json({ 
      status: "error", message: "Verification is not pending" }, { status: 400 });

    if (
      !pending.codeHash ||
      !pending.codeExpiresAt ||
      pending.codeExpiresAt < new Date()
    ) return NextResponse.json({
      status: "error",
      message: "Verification code expired",
    },{ status: 400 });

    const valid = await bcrypt.compare(
      code,
      pending.codeHash
    );

    if (!valid) return NextResponse.json({
      status: "error",
      message: "Invalid verification code",
    },{ status: 401 });

    const result = await prisma.$transaction(async (tx) => {
      const existingUser =
        await tx.user.findUnique({
          where: {
            email: pending.email,
          },
        });

      if (existingUser) {
        throw new Error("USER_ALREADY_EXISTS");
      }
      
      const user = await tx.user.create({
        data: {
          email: pending.email,
          passwordHash: pending.passwordHash,

          role: "user",

          plan: pending.plan,

          stripeCustomerId:
            pending.stripeCustomerId ?? undefined,

          stripeSubscriptionId:
            pending.stripeSubId ?? undefined,

          subscriptionStatus: "ACTIVE",

          activatedAt: new Date(),
        },

        select: {
          id: true,
          email: true,
          role: true,
          plan: true,
          subscriptionStatus: true,
        },
      });

      await tx.pendingRegistration.update({
        where: {
          id: pending.id,
        },
        data: {
          status: "VERIFIED",
          codeHash: null,
          codeExpiresAt: null,
        },
      });
      return user;
    });
    const token = await signAuthToken({
        sub: String(result.id),
        type: "user",
        email: result.email,
        role: result.role as "user"
        });

        const response = NextResponse.json(
        {
            status: "ok",
            user: result,
        },
        { status: 201 }
        );

        response.cookies.set("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        return response;

  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({
        status: "error",
        message: "Invalid request",
        errors: error.flatten(),
      },
      { status: 400 }
    );

    if (
      error instanceof Error &&
      error.message === "USER_ALREADY_EXISTS"
    ) {
      return NextResponse.json({
        status: "error",
        message: "User already exists",
      },
      { status: 409 }
    );

    console.error(
      "Verification Error:",
      error
    );

    return NextResponse.json({
      status: "error",
      message: "Internal server error",
    },
    { status: 500 }
    );
  }
}
}