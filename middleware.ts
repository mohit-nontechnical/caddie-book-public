import { NextRequest, NextResponse } from "next/server";
import { authToken } from "@/lib/auth-token";

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow login page, login API, and static assets (any path with a file extension)
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/login") ||
    /\.[^/]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const passcode = process.env.APP_PASSCODE;

  // If APP_PASSCODE is not set, allow everything through (local dev convenience)
  if (!passcode) {
    return NextResponse.next();
  }

  const expected = await authToken(passcode);
  const cookieVal = req.cookies.get("cb_auth")?.value;

  if (cookieVal === expected) {
    return NextResponse.next();
  }

  // API routes get a 401 JSON response; page routes get redirected to /login
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  return NextResponse.redirect(loginUrl);
}
