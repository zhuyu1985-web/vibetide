---
name: Push
description: 自动整理当前 working tree 的改动，按项目风格写中文 commit message，并 push 到 origin/main。
category: Git
tags: [git, commit, push]
---

执行以下步骤，**全部用中文输出**：

1. 并行跑三条只读命令了解现状：
   - `git status`（看有哪些 modified / untracked）
   - `git diff HEAD`（看具体改了什么）
   - `git log --oneline -8`（学最近的 commit message 风格）

2. **决定哪些文件要提交**：
   - 默认 stage 所有 modified 文件 + 本次对话里你 _自己创建_ 的 untracked 文件
   - **跳过看起来跟本次工作无关的 untracked 内容**（比如本会话从没碰过的 `docs/presentations/`、`.tmp` / `*.log` / 草稿目录）。如果不确定，列出来让用户确认，不要强塞进 commit
   - 永远不要 `git add -A` 或 `git add .`
   - 永远不要包含 `.env*` / credentials / 大型二进制

3. **起草 commit message**：
   - 标题：`<type>(<scope>): <中文简述>`（type 取 feat / fix / refactor / docs / chore；scope 取最贴近的模块名，如 `tikhub` / `media-dict` / `research` / `claude-md` 等）
   - 标题尽量 ≤ 60 字
   - body 用 `-` 起头的中文要点列表，重点说"为什么"和影响面，不要逐文件复述。如果改动很少（< 30 行 / 单文件），可以省略 body
   - 末尾保留 `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

4. **执行 commit**：
   - `git add <具体文件 1> <具体文件 2> ...`（具名）
   - `git commit` 用 heredoc 传 message，**不要** 加 `--amend` / `--no-verify`
   - 如果 pre-commit hook 失败：定位根因 → 修代码 → 重新 `git add` → 再次 `git commit`（**创建新 commit，不 amend**）

5. **push 到 origin/main**：
   - `git push origin main`
   - 失败（如非 fast-forward）时**不要 force-push**，先 `git pull --rebase origin main` 再推；rebase 有冲突先停下来报给用户

6. **最终回报**：
   - 一句话说明 commit hash、文件数、+/- 行数
   - 如果跳过了任何 untracked 文件，列出来提醒用户"这些没被提交，需要的话告诉我单独处理"
