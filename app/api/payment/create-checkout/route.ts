import { NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/server";
import { SITE_CONFIG } from "@/lib/constants/site";
import { COURSE_INFO } from "@/lib/constants/course";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;

export async function POST(request: Request) {
  try {
    const { registrationId } = await request.json();

    if (!registrationId) {
      return NextResponse.json(
        { error: "Registration ID is required." },
        { status: 400 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    if (!supabaseConfigured || !stripeConfigured) {
      console.warn(
        "[checkout] Supabase or Stripe keys not set — returning mock success URL so flow continues.",
        { registrationId, supabaseConfigured, stripeConfigured }
      );
      return NextResponse.json({
        sessionUrl: `${siteUrl}/payment?success=true&mock=true`,
        mock: true,
      });
    }

    const supabase = createAdminClient();
    const { data: registration, error } = await supabase
      .from("registrations")
      .select("*")
      .eq("id", registrationId)
      .single();

    if (error || !registration) {
      return NextResponse.json(
        { error: "Registration not found. Please register first." },
        { status: 404 }
      );
    }

    if (registration.payment_status === "completed") {
      return NextResponse.json(
        { error: "Payment has already been completed for this registration." },
        { status: 400 }
      );
    }

    const session = await getStripeServer().checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: SITE_CONFIG.coursePrice,
            product_data: {
              name: COURSE_INFO.title,
              description: `${COURSE_INFO.duration} — ${COURSE_INFO.hours} — ${COURSE_INFO.format}`,
            },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${siteUrl}/payment?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/payment?canceled=true&registrationId=${registrationId}`,
      customer_email: registration.email,
      metadata: { registrationId },
    });

    await supabase
      .from("registrations")
      .update({ stripe_session_id: session.id })
      .eq("id", registrationId);

    return NextResponse.json({ sessionUrl: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 }
    );
  }
}
