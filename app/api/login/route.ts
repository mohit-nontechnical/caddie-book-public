import { NextRequest, NextResponse } from "next/server";
import { authToken } from "@/lib/auth-token";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { passcode } = await req.json();

  const expected = process.env.APP_PASSCODE;

  if (!expected || passcode !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const token = await authToken(passcode);

  const isProd = process.env.NODE_ENV === "production";

  const res = NextResponse.json({ ok: true });
  res.cookies.set("cb_auth", token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    secure: isProd,
  });

  return res;
}
