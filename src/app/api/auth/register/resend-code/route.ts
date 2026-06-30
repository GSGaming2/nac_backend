import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import { rateLimit } from "@/app/lib/rateLimit";
import { prisma } from "@/app/lib/prisma";
import { sendVerificationCodeEmail } from "@/app/lib/email/email";

const ResendCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

function generateVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = ResendCodeSchema.parse(body);

    const ip = req.headers.get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ?? "local";

    const rl = await rateLimit(`rl:resend:${ip}`, 3, 60);

    if (!rl.allowed) {
      return NextResponse.json({
        status: "error",
        message: "Too many attempts",
      }, { status: 429 });
    }

    const pending = await prisma.pendingRegistration.findUnique({
      where: { email },
      select: { id: true, status: true },
    });

    if (!pending) {
      return NextResponse.json({ status: "ok" });
    }

    if (pending.status !== "CODE_SENT" && pending.status !== "PAID") {
      return NextResponse.json({ status: "ok" });
    }

    const code = generateVerificationCode();
    const codeHash = await bcrypt.hash(code, 12);
    const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.pendingRegistration.update({
      where: { id: pending.id },
      data: { status: "CODE_SENT", codeHash, codeExpiresAt },
    });

    await sendVerificationCodeEmail(email, code);

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        status: "error",
        message: "Invalid request data",
        errors: error.flatten().fieldErrors,
      }, { status: 400 });
    }

    console.error("Resend Code Error:", error);

    return NextResponse.json({
      status: "error",
      message: "Internal server error",
    }, { status: 500 });
  }
}
