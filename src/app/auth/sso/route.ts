import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/auth/session";
import { absoluteUrl } from "@/lib/auth/request-origin";
import {
  findOrProvisionUserByPhone,
  resolveSsoIdentity,
  safeNextPath,
  SsoIdentityError,
} from "@/lib/auth/cmc-sso";

export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  try {
    const identity = await resolveSsoIdentity({
      xnUserInfo: request.cookies.get("xn_userInfo")?.value,
      loginCmcId: request.cookies.get("login_cmc_id")?.value,
      loginCmcTid: request.cookies.get("login_cmc_tid")?.value,
    });

    const session = await findOrProvisionUserByPhone(identity);
    await setSession(session);

    return NextResponse.redirect(absoluteUrl(request, next));
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[auth/sso]",
        err instanceof SsoIdentityError ? err.message : err,
      );
    }

    const loginUrl = absoluteUrl(request, "/login");
    loginUrl.searchParams.set("error", "sso_failed");
    if (next !== "/home") {
      loginUrl.searchParams.set("next", next);
    }
    return NextResponse.redirect(loginUrl);
  }
}
