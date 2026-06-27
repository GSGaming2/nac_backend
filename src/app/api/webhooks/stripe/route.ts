import { NextResponse } from "next/server";
import Stripe from "stripe";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import { prisma } from "@/app/lib/prisma";
import { sendVerificationCodeEmail } from "@/app/lib/email";

export const runtime = "nodejs";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function generateVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function POST(req: Request) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error("Missing STRIPE_WEBHOOK_SECRET");
    }

    const signature = req.headers.get("stripe-signature");

    if (!signature)return NextResponse.json({
          status: "error",
          message: "Missing Stripe signature",
        },{ status: 400 }
      );

    const body = await req.text();
  const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const pendingId = session.metadata?.pendingRegistrationId;

        if (!pendingId) return NextResponse.json({ status: "ok" });

        const pending = await prisma.pendingRegistration.findUnique({
          where: {
            id: pendingId,
          },
        });

        if (!pending) return NextResponse.json({ status: "ok" });

        // Already processed
        if (pending.status === "CODE_SENT" || pending.status === "VERIFIED") {
          return NextResponse.json({ status: "ok" });
        }

        const code = generateVerificationCode();
        const codeHash = await bcrypt.hash(code, 10);

        const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        let currentPeriodEnd: Date | null = null;

        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            String(session.subscription)
          );

          // Depending on Stripe API version, adjust if needed
          const periodEnd = (subscription as any).current_period_end;

          if (periodEnd) {
            currentPeriodEnd = new Date(periodEnd * 1000);
          }
        }

        await prisma.$transaction(async (tx) => {
          await tx.pendingRegistration.update({
            where: {
              id: pending.id,
            },
            data: {
              status: "CODE_SENT",

              codeHash,
              codeExpiresAt,

              stripeCustomerId:
                session.customer?.toString() ?? null,

              stripeSubId:
                session.subscription?.toString() ?? null,

              currentPeriodEnd,
            },
          });
        });

        // Send email first
        try {
              console.log("Sending email to:", pending.email);

              const result = await sendVerificationCodeEmail(
                pending.email,
                code
              );

              console.log("Resend response:", result);
            } catch (error) {
              console.error("Email sending failed:", error);
              throw error;
            }

        break;
      }

      default:
        break;
    }

    return NextResponse.json({
      status: "ok",
    });
  } catch (error) {
    console.error(
      "Stripe Webhook Error:",
      error
    );

    return NextResponse.json({
      status: "error",
      message: "Webhook processing failed",
    },
    { status: 400 }
    );
  }
}