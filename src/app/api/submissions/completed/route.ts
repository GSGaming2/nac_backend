import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { AuthError, requireUser } from "@/app/lib/auth/requireAuth";

export async function POST() {
  try {
    const auth = await requireUser();

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: {
          id: Number(auth.sub),
        },
        select: {
          id: true,
          submissionCount: true,
        },
      });

      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      return tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          submissionCount: {
            increment: 1,
          },
        },
        select: {
          submissionCount: true,
        },
      });
    });

    return NextResponse.json({
      status: "ok",
      message: "Submission recorded successfully.",
      data: {
        submissionCount: updatedUser.submissionCount,
      },
    }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({
        status: "error",
        message: error.message,
      }, { status: error.status });
    }

    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return NextResponse.json({
        status: "error",
        message: "User not found.",
      }, { status: 404 });
    }

    console.error("Complete Submission Error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: "Internal server error.",
      },
      { status: 500 }
    );
  }
}