import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // 排除 API（路由自带 requireAuth 鉴权；302 会破坏前端 fetch）与静态资源
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
