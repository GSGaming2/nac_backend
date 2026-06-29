import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";

import { prisma } from "@/app/lib/prisma";
import { rateLimit } from "@/app/lib/rateLimit";
import { sendPasswordResetEmail } from "@/app/lib/email/email";

const ForgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const SUCCESS_RESPONSE = {
  status: "ok",
  message:
    "If an account exists for this email, a password reset link has been sent.",
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = ForgotPasswordSchema.parse(body);

    const ip =
      req.headers
        .get("x-forwarded-for")
        ?.split(",")[0]
        ?.trim() ?? "local";

    const rl = await rateLimit(`rl:forgot:${ip}`, 5, 60);

    if (!rl.allowed) {
      return NextResponse.json(
        {
          status: "error",
          message: "Too many password reset attempts. Please try again later.",
        },
        { status: 429 }
      );
    }

    const [user, admin] = await Promise.all([
      prisma.user.findUnique({
        where: { email },
        select: { id: true },
      }),
      prisma.admin.findUnique({
        where: { email },
        select: { id: true },
      }),
    ]);

    if (!user && !admin) {
      return NextResponse.json(SUCCESS_RESPONSE);
    }

    // Generate a secure token
    const token = crypto.randomBytes(32).toString("hex");

    // Store only the hash
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      // Remove expired tokens
      await tx.passwordResetToken.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });

      // Invalidate any previous unused tokens
      await tx.passwordResetToken.updateMany({
        where: {
          email,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      // Create new token
      await tx.passwordResetToken.create({
        data: {
          email,
          tokenHash,
          expiresAt,
        },
      });
    });

    try {
      await sendPasswordResetEmail(email, token);
    } catch (error) {
      console.error("Email Send Error:", error);

      // Don't leave an active token behind if email delivery fails
      await prisma.passwordResetToken.deleteMany({
        where: {
          email,
          tokenHash,
          usedAt: null,
        },
      });

      throw error;
    }

    return NextResponse.json(SUCCESS_RESPONSE);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          status: "error",
          message: "Invalid request data.",
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    console.error("Forgot Password Error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: "Internal server error.",
      },
      { status: 500 }
    );
  }
}