import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/requireAuth";
import { SUBMISSION_LIMITS } from "@/app/lib/constants/submissionLimits";

export async function GET() {
  try {
    const auth = await requireAuth();

    if (auth.type !== "user") {
      return NextResponse.json({
        status: "error",
        message: "Only users can submit.",
      }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(auth.sub) },
      select: {
        plan: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        submissionCount: true,
      },
    });

    if (!user) {
      return NextResponse.json({
        status: "error",
        message: "User not found.",
      }, { status: 404 });
    }

    const limit = user.plan ? SUBMISSION_LIMITS[user.plan] : null;
    const remaining = limit !== null ? Math.max(0, limit - user.submissionCount) : null;

    return NextResponse.json({
      status: "ok",
      data: {
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        submissionCount: user.submissionCount,
        submissionLimit: limit,
        remaining,
        resetDate: user.currentPeriodEnd?.toISOString() ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_AUTHENTICATED") {
      return NextResponse.json({
        status: "error",
        message: "Not authenticated.",
      }, { status: 401 });
    }

    console.error("Check Submissions Error:", error);

    return NextResponse.json({
      status: "error",
      message: "Internal server error.",
    }, { status: 500 });
  }
}
