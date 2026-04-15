import { describe, it, expect } from "vitest";
import { listMyResearchTasks } from "../research-tasks";
import { db } from "@/db";
import { organizations, userProfiles } from "@/db/schema";

describe("listMyResearchTasks", () => {
  it("returns array of correct shape", async () => {
    const [org] = await db.select({ id: organizations.id }).from(organizations).limit(1);
    const [user] = await db.select({ id: userProfiles.id }).from(userProfiles).limit(1);
    if (!org || !user) {
      // No seed users — just verify function doesn't throw with dummy ids
      const result = await listMyResearchTasks(
        "00000000-0000-0000-0000-000000000000",
        "00000000-0000-0000-0000-000000000000",
      );
      expect(Array.isArray(result)).toBe(true);
      return;
    }
    const result = await listMyResearchTasks(org.id, user.id);
    expect(Array.isArray(result)).toBe(true);
    for (const t of result) {
      expect(typeof t.topicCount).toBe("number");
      expect(typeof t.crawledCount).toBe("number");
    }
  });
});
