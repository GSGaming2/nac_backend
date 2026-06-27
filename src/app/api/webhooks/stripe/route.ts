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
  console.log("🔥 WEBHOOK HIT");

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error("Missing STRIPE_WEBHOOK_SECRET");
    }

    const signature = req.headers.get("stripe-signature");

    console.log("Stripe Signature:", signature);

    if (!signature) {
      return NextResponse.json(
        {
          status: "error",
          message: "Missing Stripe signature",
        },
        { status: 400 }
      );
    }

    // IMPORTANT: Read the body ONLY ONCE
    const body = await req.text();

    console.log("Body length:", body.length);

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );

    console.log("Stripe Event:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        console.log("Checkout Session:", session.id);

        const pendingId = session.metadata?.pendingRegistrationId;

        if (!pendingId) {
          console.log("No pendingRegistrationId found in metadata.");
          return NextResponse.json({ status: "ok" });
        }

        const pending = await prisma.pendingRegistration.findUnique({
          where: {
            id: pendingId,
          },
        });

        if (!pending) {
          console.log("Pending registration not found.");
          return NextResponse.json({ status: "ok" });
        }

        if (
          pending.status === "CODE_SENT" ||
          pending.status === "VERIFIED"
        ) {
          console.log("Webhook already processed.");
          return NextResponse.json({ status: "ok" });
        }

        const code = generateVerificationCode();
        const codeHash = await bcrypt.hash(code, 10);
        const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        let currentPeriodEnd: Date | null = null;

        try {
          if (session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(
              String(session.subscription)
            );

            const periodEnd = (subscription as any).current_period_end;

            if (periodEnd) {
              currentPeriodEnd = new Date(periodEnd * 1000);
            }
          }
        } catch (err) {
          console.error("Failed to retrieve subscription:", err);
        }

        console.log("Sending verification email to:", pending.email);

        await sendVerificationCodeEmail(pending.email, code);

        console.log("Email sent successfully.");

        await prisma.pendingRegistration.update({
          where: {
            id: pending.id,
          },
          data: {
            status: "CODE_SENT",
            codeHash,
            codeExpiresAt,
            stripeCustomerId: session.customer?.toString() ?? null,
            stripeSubId: session.subscription?.toString() ?? null,
            currentPeriodEnd,
          },
        });

        console.log("Pending registration updated.");

        break;
      }

      default:
        console.log(`Ignoring event: ${event.type}`);
        break;
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Stripe Webhook Error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: "Webhook processing failed",
      },
      { status: 400 }
    );
  }
}