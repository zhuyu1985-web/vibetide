import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../..");
const sourceScript = path.join(repoRoot, "scripts/db-export-incremental.sh");

// Hermetic git 环境：删掉所有会让 git 跳过 cwd-based 发现、改去 auto-discover
// 外部仓库的环境变量。husky / lint-staged 钩子以及 git worktree 上下文会注入
// GIT_DIR / GIT_WORK_TREE / GIT_INDEX_FILE 等；一旦被 git 子进程继承，cwd 会
// 被忽略，本测试的 git init / config 就会落到真实仓库——曾把共享 .git/config 的
// core.bare 改成 true，瘫痪主工作树和所有 worktree。设为 undefined 会让 Node
// 在拼 child env 时跳过这些 key（而非传成字符串 "undefined"），等价于删除。
const HERMETIC_GIT_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_DIR: undefined,
  GIT_WORK_TREE: undefined,
  GIT_INDEX_FILE: undefined,
  GIT_OBJECT_DIRECTORY: undefined,
  GIT_ALTERNATE_OBJECT_DIRECTORIES: undefined,
  GIT_COMMON_DIR: undefined,
  GIT_NAMESPACE: undefined,
  GIT_CEILING_DIRECTORIES: undefined,
  GIT_PREFIX: undefined,
};

describe("scripts/db-export-incremental.sh", () => {
  it("appends data-only pg_dump output for tables created by included migrations", () => {
    const workspace = path.join(
      tmpdir(),
      `vibetide-db-export-incremental-${process.pid}-${Date.now()}`,
    );

    mkdirSync(path.join(workspace, "scripts"), { recursive: true });
    mkdirSync(path.join(workspace, "backups"), { recursive: true });
    mkdirSync(path.join(workspace, "supabase/migrations"), { recursive: true });
    mkdirSync(path.join(workspace, "bin"), { recursive: true });

    const scriptPath = path.join(workspace, "scripts/db-export-incremental.sh");
    writeFileSync(scriptPath, readFileSync(sourceScript, "utf8"));
    chmodSync(scriptPath, 0o755);

    writeFileSync(
      path.join(workspace, "backups/MANIFEST.md"),
      [
        "| 日期 | 版本 | 类型 | 文件 | 大小 | 孤儿剔除 | 备注 |",
        "|------|------|------|------|------|----------|------|",
        "| 2026-01-01 | v1 | full | backups/2026-01-01-v1/full.sql | 1K | 0 | — |",
        "",
      ].join("\n"),
    );
    writeFileSync(
      path.join(workspace, "supabase/migrations/20260102000001_add_widgets.sql"),
      [
        'CREATE TABLE "widgets" (',
        '  "id" uuid PRIMARY KEY,',
        '  "name" text NOT NULL',
        ");",
        "",
      ].join("\n"),
    );
    writeFileSync(
      path.join(workspace, ".env.local"),
      'DATABASE_URL="postgres://user:pass@example.test:5432/vibetide"\n',
    );

    // 所有 git 子进程都用绝对路径 cwd + 隔离 env，确保只操作这个临时仓库，
    // 绝不触碰 ambient 仓库。
    const absWorkspace = path.resolve(workspace);
    const git = (args: string[]) =>
      execFileSync("git", args, {
        cwd: absWorkspace,
        stdio: "pipe",
        env: HERMETIC_GIT_ENV,
      });

    git(["init"]);
    git(["config", "user.email", "test@example.test"]);
    git(["config", "user.name", "Test User"]);
    git(["add", "backups/MANIFEST.md"]);
    git(["commit", "-m", "baseline"]);

    const fakePgDump = path.join(workspace, "bin/pg_dump");
    const pgDumpArgs = path.join(workspace, "pg-dump-args.txt");
    writeFileSync(
      fakePgDump,
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        `printf '%s\\n' "$@" > ${JSON.stringify(pgDumpArgs)}`,
        "out=''",
        "while [[ $# -gt 0 ]]; do",
        "  if [[ \"$1\" == '-f' ]]; then",
        "    out=\"$2\"",
        "    shift 2",
        "    continue",
        "  fi",
        "  shift",
        "done",
        "cat > \"$out\" <<'SQL'",
        '-- Data for Name: widgets; Type: TABLE DATA; Schema: public; Owner: -',
        "",
        'COPY public."widgets" ("id", "name") FROM stdin;',
        "00000000-0000-0000-0000-000000000001\tAlpha",
        "\\.",
        "SQL",
        "",
      ].join("\n"),
    );
    chmodSync(fakePgDump, 0o755);

    // 脚本内部也会跑 `git log`（拿 migration 首次提交时间），同样必须用隔离 env，
    // 否则它会查到真实仓库的 git 历史。
    execFileSync("bash", [scriptPath, "2026-01-03", "v1"], {
      cwd: absWorkspace,
      env: {
        ...HERMETIC_GIT_ENV,
        PG_DUMP: fakePgDump,
      },
      stdio: "pipe",
    });

    const incrementalSql = readFileSync(
      path.join(workspace, "backups/2026-01-03-v1-incremental/incremental.sql"),
      "utf8",
    );
    const args = readFileSync(pgDumpArgs, "utf8");

    expect(args).toContain("--data-only");
    expect(args).toContain("--table=public.widgets");
    expect(incrementalSql).toContain("-- 新增表数据");
    expect(incrementalSql).toContain('COPY public."widgets" ("id", "name") FROM stdin;');
    expect(incrementalSql).toContain(
      "00000000-0000-0000-0000-000000000001\tAlpha",
    );
  });
});
