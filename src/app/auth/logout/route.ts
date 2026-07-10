import { NextRequest, NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/auth/request-origin";
import { applyLogoutCookies } from "@/lib/auth/logout-response";

export async function GET(request: NextRequest) {
  const loginUrl = absoluteUrl(request, "/login");
  loginUrl.searchParams.set("logged_out", "1");

  const response = NextResponse.redirect(loginUrl);
  applyLogoutCookies(request, response);
  return response;
}
