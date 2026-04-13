import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  aiEmployees,
  employeeMemories,
  userProfiles,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Persist user feedback (like / dislike) on an assistant response.
 *
 * Feedback is stored as an `employee_memories` row with `memoryType: 'feedback'`.
 * The agent assembly layer (`src/lib/agent/assembly.ts`) loads the top-10 most
 * important memories by default and `prompt-templates.ts` injects them into
 * Layer 6 ("经验记忆") of the system prompt. So feedback directly steers the
 * employee's future outputs without any additional plumbing.
 *
 * We intentionally store the user prompt + a trimmed excerpt of the response
 * so the memory is specific enough to influence similar future turns, but
 * short enough not to bloat prompts.
 */
export async function POST(req: Request) {
  try {
    // Auth
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { employeeSlug, feedbackType, userPrompt, messageContent } =
      body as {
        employeeSlug: string;
        feedbackType: "like" | "dislike";
        userPrompt?: string;
        messageContent: string;
      };

    if (
      !employeeSlug ||
      !messageContent ||
      (feedbackType !== "like" && feedbackType !== "dislike")
    ) {
      return new Response("缺少必要参数", { status: 400 });
    }

    // Look up organization
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
    });
    if (!profile?.organizationId) {
      return new Response("Organization not found", { status: 403 });
    }

    // Resolve the employee from slug + org
    const employeeRecord = await db.query.aiEmployees.findFirst({
      where: and(
        eq(aiEmployees.slug, employeeSlug),
        eq(aiEmployees.organizationId, profile.organizationId)
      ),
    });
    if (!employeeRecord) {
      return new Response("员工不存在或无权操作", { status: 403 });
    }

    // Clip excerpts so memories stay prompt-friendly
    const clip = (s: string, n: number) =>
      s.length > n ? s.slice(0, n) + "..." : s;
    const userExcerpt = userPrompt ? clip(userPrompt.trim(), 120) : "";
    const responseExcerpt = clip(messageContent.trim(), 240);

    const content =
      feedbackType === "like"
        ? `用户对这条回复表示赞赏。${
            userExcerpt ? `用户问题："${userExcerpt}"。` : ""
          }被肯定的要点："${responseExcerpt}"。请在类似场景下继续保持这种输出风格与深度。`
        : `用户对这条回复不满意。${
            userExcerpt ? `用户问题："${userExcerpt}"。` : ""
          }需要避免的问题："${responseExcerpt}"。请在类似场景下调整表达方式、补充信息或换用更合适的切入角度。`;

    // Importance: dislike is weighted slightly higher so the model avoids
    // repeating mistakes more aggressively than it imitates successes.
    const importance = feedbackType === "dislike" ? 0.9 : 0.75;

    await db.insert(employeeMemories).values({
      employeeId: employeeRecord.id,
      organizationId: profile.organizationId,
      memoryType: "feedback",
      content,
      source: `user_feedback:${feedbackType}`,
      importance,
      confidence: 1.0,
      // Slightly faster decay than defaults (0.01) so old feedback phases out
      decayRate: 0.02,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[chat/feedback] Unhandled error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal Server Error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
