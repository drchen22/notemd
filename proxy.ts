import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD ?? "notemd";
const AUTH_SECRET = process.env.AUTH_SECRET ?? "notemd-secret-2024";

function sessionToken(): string {
  return createHash("sha256").update(ACCESS_PASSWORD + AUTH_SECRET).digest("hex");
}

const PUBLIC_PATHS = ["/login", "/api/auth"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const session = request.cookies.get("session")?.value;
  const expected = sessionToken();

  if (!session || session !== expected) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
