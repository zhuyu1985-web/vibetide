import { redirect } from "next/navigation";

// 首页 /home 已是统一工作台落地页(R1 合并)。裸 /cowork 落地页下线,
// 重定向到 /home;会话仍在 /cowork/[conversationId]。
export default function CoworkLandingRedirect() {
  redirect("/home");
}
