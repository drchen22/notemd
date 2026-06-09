import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD ?? "notemd";
const AUTH_SECRET = process.env.AUTH_SECRET ?? "notemd-secret-2024";

function sessionToken(): string {
  return createHash("sha256").update(ACCESS_PASSWORD + AUTH_SECRET).digest("hex");
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const password = body.password as string | undefined;

  if (!password || password !== ACCESS_PASSWORD) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }

  const token = sessionToken();

  const response = NextResponse.json({ success: true });
  response.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
