import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/requireAuth";
import { SUBMISSION_LIMITS } from "@/app/lib/constants/submissionLimits";

export async function POST() {
  try {
    const auth = await requireAuth();

    if (auth.type !== "user") {
      return NextResponse.json(
        {
          status: "error",
          message: "Only users can submit.",
        },
        { status: 403 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: {
          id: Number(auth.sub),
        },
        select: {
          id: true,
          plan: true,
          subscriptionStatus: true,
          currentPeriodEnd: true,
          submissionCount: true,
        },
      });

      if (!user) {
        return {
          status: 404,
          body: {
            status: "error",
            message: "User not found.",
          },
        };
      }

      if (user.subscriptionStatus !== "ACTIVE") {
        return {
          status: 403,
          body: {
            status: "error",
            message: "Your subscription is not active.",
          },
        };
      }
      if (!user.plan) return {
          status: 403,
          body: {
            status: "error",
            message: "Your plan is not set.",
          },
        };

      const limit = SUBMISSION_LIMITS[user.plan];

      if (limit !== null && user.submissionCount >= limit) {
        const resetDate = user.currentPeriodEnd? 
        user.currentPeriodEnd.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "your next renewal";

        return {
          status: 429,
          body: {
            status: "error",
            message: `You have reached your monthly submission limit. Your submissions will reset on ${resetDate}.`,
          },
        };
      }

      // -----------------------------------------
      // Future:
      // Create the user's submission here
      // -----------------------------------------

      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          submissionCount: {
            increment: 1,
          },
        },
      });

      return {
        status: 200,
        body: {
          status: "ok",
          message: "Submission accepted.",
          data: {
            submissionCount: user.submissionCount + 1,
            submissionLimit: limit,
          },
        },
      };
    });

    return NextResponse.json(result.body, {
      status: result.status,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_AUTHENTICATED") return NextResponse.json({
          status: "error",
          message: "Not authenticated.",
        },{ status: 401 });

    console.error("Submission Error:", error);

    return NextResponse.json({
        status: "error",
        message: "Internal server error.",
      },{ status: 500 });
  }
}
