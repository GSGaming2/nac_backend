import { NextResponse } from "next/server";
import { z } from "zod";

import { resetPassword } from "@/app/lib/email/reset-password";

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, newPassword } = ResetPasswordSchema.parse(body);

    const { email } = await resetPassword(token, newPassword);

    return NextResponse.json({
      status: "ok",
      message: "Password reset successfully",
      email,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        status: "error",
        message: "Invalid request data",
        errors: error.flatten().fieldErrors,
      }, { status: 400 });
    }

    if (error instanceof Error) {
      if (error.message === "INVALID_OR_EXPIRED_TOKEN") {
        return NextResponse.json({
          status: "error",
          message: "Invalid or expired reset token",
        }, { status: 400 });
      }

      if (error.message === "ACCOUNT_NOT_FOUND") {
        return NextResponse.json({
          status: "error",
          message: "Account not found",
        }, { status: 404 });
      }
    }

    console.error("Reset Password Error:", error);

    return NextResponse.json({
      status: "error",
      message: "Internal server error",
    }, { status: 500 });
  }
}
