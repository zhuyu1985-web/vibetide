import { describe, it, expect } from "vitest";
import os from "node:os";
import fs from "node:fs/promises";
import { runCli } from "../spawn";
import { withScratchDir } from "../scratch";

// ─── runCli ───────────────────────────────────────────────────────────────────

describe("runCli() — 退出码捕获", () => {
  it("正常退出 exitCode=0", async () => {
    const result = await runCli(
      process.execPath,
      ["-e", "process.exit(0)"],
      { cwd: os.tmpdir(), timeoutMs: 5000 }
    );
    expect(result.exitCode).toBe(0);
  });

  it("非零退出码正常 resolve（exitCode=3）", async () => {
    const result = await runCli(
      process.execPath,
      ["-e", "process.exit(3)"],
      { cwd: os.tmpdir(), timeoutMs: 5000 }
    );
    expect(result.exitCode).toBe(3);
  });
});

describe("runCli() — stderr 捕获", () => {
  it("stderr 内容出现在 stderrTail，exitCode=1", async () => {
    const result = await runCli(
      process.execPath,
      ["-e", "process.stderr.write('boom'); process.exit(1)"],
      { cwd: os.tmpdir(), timeoutMs: 5000 }
    );
    expect(result.stderrTail).toContain("boom");
    expect(result.exitCode).toBe(1);
  });
});

describe("runCli() — 超时杀死子进程", () => {
  it("超时时 reject，且在合理时间内完成（不等待子进程自然结束）", async () => {
    const start = Date.now();
    await expect(
      runCli(
        process.execPath,
        ["-e", "setTimeout(()=>{}, 60000)"],
        { cwd: os.tmpdir(), timeoutMs: 100 }
      )
    ).rejects.toThrow("CLI 超时");
    // 如果子进程真的跑了 60 秒才退出，下面的断言会失败；
    // 只要 SIGKILL 成功，整体耗时应远小于 5 秒
    expect(Date.now() - start).toBeLessThan(5000);
  });
});

describe("runCli() — spawn 错误（ENOENT）", () => {
  it("不存在的可执行文件 → reject", async () => {
    await expect(
      runCli(
        "definitely-not-a-real-binary-xyz",
        [],
        { cwd: os.tmpdir(), timeoutMs: 5000 }
      )
    ).rejects.toThrow();
  });
});

// ─── withScratchDir ───────────────────────────────────────────────────────────

describe("withScratchDir() — 生命周期", () => {
  it("fn 执行期间目录存在，fn 返回后目录被删除", async () => {
    let capturedDir = "";

    await withScratchDir(async (dir) => {
      capturedDir = dir;
      // fn 执行期间目录必须存在
      const stat = await fs.stat(dir);
      expect(stat.isDirectory()).toBe(true);
    });

    // fn 返回后目录必须被删除
    await expect(fs.stat(capturedDir)).rejects.toThrow();
  });

  it("fn 抛出时目录仍被清理（finally 保证）", async () => {
    let capturedDir = "";

    await expect(
      withScratchDir(async (dir) => {
        capturedDir = dir;
        throw new Error("fn 故意抛出");
      })
    ).rejects.toThrow("fn 故意抛出");

    // 即使 fn 抛出，目录也必须被删除
    await expect(fs.stat(capturedDir)).rejects.toThrow();
  });
});
