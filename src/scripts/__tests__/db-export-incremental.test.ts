import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../..");
const sourceScript = path.join(repoRoot, "scripts/db-export-incremental.sh");

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

    execFileSync("git", ["init"], { cwd: workspace, stdio: "pipe" });
    execFileSync("git", ["config", "user.email", "test@example.test"], {
      cwd: workspace,
      stdio: "pipe",
    });
    execFileSync("git", ["config", "user.name", "Test User"], {
      cwd: workspace,
      stdio: "pipe",
    });
    execFileSync("git", ["add", "backups/MANIFEST.md"], {
      cwd: workspace,
      stdio: "pipe",
    });
    execFileSync("git", ["commit", "-m", "baseline"], {
      cwd: workspace,
      stdio: "pipe",
    });

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

    execFileSync("bash", [scriptPath, "2026-01-03", "v1"], {
      cwd: workspace,
      env: {
        ...process.env,
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
