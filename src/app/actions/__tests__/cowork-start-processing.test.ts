import { beforeEach, describe, expect, it, vi } from "vitest";

const createConversationMock = vi.hoisted(() => vi.fn());
const appendMessageMock = vi.hoisted(() => vi.fn());
const claimProcessingMock = vi.hoisted(() => vi.fn());
const finishProcessingMock = vi.hoisted(() => vi.fn());
const getConversationMock = vi.hoisted(() => vi.fn());
const getConversationWithMessagesMock = vi.hoisted(() => vi.fn());
const initializeProcessingMock = vi.hoisted(() => vi.fn());
const resetProcessingMock = vi.hoisted(() => vi.fn());
const submitMessageMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(async () => ({ id: "user-1" })),
}));
vi.mock("@/lib/dal/auth", () => ({
  getCurrentUserOrg: vi.fn(async () => "org-1"),
}));
vi.mock("@/lib/dal/cowork-conversations", () => ({
  createConversation: createConversationMock,
  appendMessage: appendMessageMock,
  claimInitialConversationProcessing: claimProcessingMock,
  finishInitialConversationProcessing: finishProcessingMock,
  getConversationById: getConversationMock,
  getConversationWithMessages: getConversationWithMessagesMock,
  initializeInitialConversationProcessing: initializeProcessingMock,
  resetInitialConversationProcessing: resetProcessingMock,
}));
vi.mock("@/app/actions/cowork-submit", () => ({
  submitCoworkMessage: submitMessageMock,
}));
vi.mock("@/lib/dal/workflow-templates", () => ({
  getWorkflowTemplate: vi.fn(),
}));
vi.mock("@/app/actions/workflow-launch", () => ({
  startMissionFromTemplate: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  processStartedCoworkConversation,
  retryStartedCoworkConversation,
  startCoworkConversation,
} from "../cowork-start";

describe("initial cowork processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createConversationMock.mockResolvedValue({ id: "conversation-1" });
  });

  it("creates a pending state and returns before intent processing", async () => {
    const result = await startCoworkConversation("查一下今天的 AI 新闻");

    expect(result).toEqual({
      ok: true,
      conversationId: "conversation-1",
    });
    expect(createConversationMock).toHaveBeenCalledWith(
      "org-1",
      "user-1",
      expect.objectContaining({
        metadata: {
          initialProcessing: expect.objectContaining({
            status: "pending",
            prompt: "查一下今天的 AI 新闻",
          }),
        },
      }),
    );
    expect(appendMessageMock).toHaveBeenCalledWith(
      "conversation-1",
      expect.objectContaining({ role: "user" }),
    );
    expect(submitMessageMock).not.toHaveBeenCalled();
  });

  it("claims and processes the prompt exactly once", async () => {
    claimProcessingMock.mockResolvedValue({
      status: "running",
      prompt: "查 AI 新闻",
      attempt: 1,
      updatedAt: new Date().toISOString(),
    });
    submitMessageMock.mockResolvedValue({
      ok: true,
      kind: "mission",
      missionId: "mission-1",
    });

    await expect(
      processStartedCoworkConversation("conversation-1"),
    ).resolves.toMatchObject({
      ok: true,
      status: "completed",
      missionId: "mission-1",
    });
    expect(submitMessageMock).toHaveBeenCalledTimes(1);
    expect(finishProcessingMock).toHaveBeenCalledWith(
      "org-1",
      "user-1",
      "conversation-1",
      "completed",
    );
  });

  it("does not duplicate processing when another page owns the lease", async () => {
    claimProcessingMock.mockResolvedValue(null);
    getConversationMock.mockResolvedValue({
      metadata: {
        initialProcessing: {
          status: "running",
          prompt: "查 AI 新闻",
          attempt: 1,
          updatedAt: new Date().toISOString(),
        },
      },
    });

    const result = await processStartedCoworkConversation("conversation-1");

    expect(result).toMatchObject({ ok: false, status: "running" });
    expect(submitMessageMock).not.toHaveBeenCalled();
  });

  it("recovers a legacy processing URL whose metadata was never created", async () => {
    claimProcessingMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        status: "running",
        prompt: "旧会话请求",
        attempt: 1,
        updatedAt: new Date().toISOString(),
      });
    getConversationMock.mockResolvedValue({ metadata: null });
    getConversationWithMessagesMock.mockResolvedValue({
      conversation: { id: "conversation-1", metadata: null },
      messages: [{ role: "user", content: "旧会话请求" }],
    });
    initializeProcessingMock.mockResolvedValue({
      status: "pending",
      prompt: "旧会话请求",
      attempt: 0,
      updatedAt: new Date().toISOString(),
    });
    submitMessageMock.mockResolvedValue({ ok: true, kind: "chat", reply: "完成" });

    await expect(
      processStartedCoworkConversation("conversation-1"),
    ).resolves.toMatchObject({ ok: true, status: "completed" });
    expect(initializeProcessingMock).toHaveBeenCalledWith(
      "org-1",
      "user-1",
      "conversation-1",
      "旧会话请求",
    );
  });

  it("resets a failed state for retry", async () => {
    resetProcessingMock.mockResolvedValue({
      status: "pending",
      prompt: "查 AI 新闻",
      attempt: 1,
      updatedAt: new Date().toISOString(),
    });

    await expect(
      retryStartedCoworkConversation("conversation-1"),
    ).resolves.toEqual({ ok: true, status: "pending" });
  });
});
