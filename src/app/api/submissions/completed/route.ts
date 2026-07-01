import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/requireAuth";

export async function POST() {
  try {
    const auth = await requireAuth();

    if (auth.type !== "user") {
      return NextResponse.json(
        {
          status: "error",
          message: "Only users can complete submissions.",
        },
        { status: 403 }
      );
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: {
          id: Number(auth.sub), // If your User.id is String, remove Number()
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

    return NextResponse.json(
      {
        status: "ok",
        message: "Submission recorded successfully.",
        data: {
          submissionCount: updatedUser.submissionCount,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_AUTHENTICATED") {
        return NextResponse.json(
          {
            status: "error",
            message: "Not authenticated.",
          },
          { status: 401 }
        );
      }

      if (error.message === "USER_NOT_FOUND") {
        return NextResponse.json(
          {
            status: "error",
            message: "User not found.",
          },
          { status: 404 }
        );
      }
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