import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/services/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const { error } = await resend.emails.send({
    from: "Dear My Routines <no-reply@hyeyoungjo.com>",
    to: ADMIN_EMAIL,
    subject: `Feedback from ${user.email}`,
    text: `From: ${user.email}\n\n${message}`,
  });

  if (error) {
    console.error("Resend error:", error);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
