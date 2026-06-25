import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  plan: z.enum(["MONTHLY", "YEARLY"]),
});

export async function POST(req: Request) {
  try {
    console.log("Registering user");
    const body = await req.json();
    const { email, password, plan } = RegisterSchema.parse(body);

    const normalizedEmail = email.toLowerCase().trim();

    // 1) Block if a real user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { status: "error", message: "Email already registered" },
        { status: 409 }
      );
    }

    // 2) Pick Stripe price by plan
    console.log("Picking Stripe price by plan");
    const priceId =
      plan === "MONTHLY"
        ? process.env.STRIPE_PRICE_MONTHLY
        : process.env.STRIPE_PRICE_YEARLY;

    if (!priceId) {
      return NextResponse.json(
        { status: "error", message: "Stripe price is not configured for this plan" },
        { status: 500 }
      );
    }

    if (!process.env.APP_URL) {
      return NextResponse.json(
        { status: "error", message: "APP_URL is not configured" },
        { status: 500 }
      );
    }

    // 3) Store pending registration (registration is "on hold" until paid+verified)
    const passwordHash = await bcrypt.hash(password, 12);

    const pending = await prisma.pendingRegistration.upsert({
      where: { email: normalizedEmail },
      update: {
        passwordHash,
        plan, // assuming enum Plan { MONTHLY YEARLY }
        status: "CREATED",
        // optional: clear any old code so they can't reuse it
        codeHash: null,
        codeExpiresAt: null,
      },
      create: {
        email: normalizedEmail,
        passwordHash,
        plan,
        status: "CREATED",
      },
      select: { id: true, email: true },
    });

    console.log("Created pending registration");
    // 4) Create Stripe Checkout session (subscription)
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: pending.email,

      success_url: `${process.env.APP_URL}/register/verify-code?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/register`,

      metadata: {
        pendingRegistrationId: pending.id,
        plan,
      },
    });

    console.log("Created Stripe Checkout session");
    // 5) Save session id for webhook correlation/debugging
    await prisma.pendingRegistration.update({
      where: { id: pending.id },
      data: {
        stripeSessionId: session.id,
        status: "CHECKOUT_CREATED",
      },
    });

    return NextResponse.json(
      { status: "ok", checkoutUrl: session.url },
      { status: 200 }
    );
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json(
        { status: "error", message: "Invalid input", details: err.errors },
        { status: 400 }
      );
    }

    // keep this simple/robust across your dual-client setup
    if (err?.code === "P2002") {
      return NextResponse.json(
        { status: "error", message: "Email already registered (unique constraint)" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { status: "error", message: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}