import { NextResponse, type NextRequest } from "next/server";

export function proxy(_request: NextRequest) {
  // Pass through — auth is handled in dashboard layout with timeout.
  // Supabase session refresh can be re-enabled once connectivity is stable.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/inngest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
