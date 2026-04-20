#!/usr/bin/env python3
"""
batch-append-skill-references.py

批量为 skills/ 目录下所有 SKILL.md 追加 "## 参考资料" section，
链接到共享媒体规范文档 + 各 skill 自己的 references/ 文件。

处理逻辑：
- 已有 "## 参考资料" section：在末尾追加新链接（不覆盖）
- 没有 section：直接追加整个 section

用法：python3 scripts/batch-append-skill-references.py
"""
from pathlib import Path
import os

# P1 / P0 skills 有专属 reference，这里用其映射
SKILL_SPECIFIC_REFS = {
    "trending_topics": [("平台热榜 API 规范", "./references/platform-ranking-specs.md")],
    "trend_monitor": [("趋势检测方法论", "./references/trend-detection-methods.md")],
    "news_aggregation": [("去重与事件归档规则", "./references/deduplication-and-merging.md")],
    "heat_scoring": [("热度算法公式与基准", "./references/heat-algorithm-formulas.md")],
    "sentiment_analysis": [("情感维度与中立判定", "./references/sentiment-dimensions-extended.md")],
    "audience_analysis": [("画像模板库", "./references/persona-template-library.md")],
    # P0 已完成的专属 reference
    "content_generate": [("场景评分 Rubric", "./references/scenario-rubric-detailed.md")],
    "headline_generate": [("场景句式模式库", "./references/headline-patterns-by-scenario.md")],
    "quality_review": [("8 维评分扩展 Rubric", "./references/review-rubric-extended.md")],
    "fact_check": [
        ("官方信源白名单", "./references/source-whitelist.md"),
        ("典型核查错误案例", "./references/typical-errors.md"),
    ],
    "summary_generate": [("按平台差异化 Style Guide", "./references/summary-style-by-platform.md")],
}

# 共享链接（所有 skill 都加）
SHARED_LINK = ("媒体行业专业标准（共享）", "../../docs/skills/media-industry-standards.md")


def build_ref_section(skill_slug: str) -> str:
    """为指定 skill 构建完整的 "## 参考资料" section。"""
    lines = ["", "## 参考资料", ""]

    # skill 专属 refs
    specific = SKILL_SPECIFIC_REFS.get(skill_slug, [])
    for label, url in specific:
        lines.append(f"- **{label}**：[{url}]({url})")

    # 共享链接
    label, url = SHARED_LINK
    lines.append(f"- **{label}**：[{url}]({url})")

    # 标准尾部
    lines.append(f"- 历史版本：`git log --follow skills/{skill_slug}/SKILL.md`")
    lines.append("")

    return "\n".join(lines)


def append_or_merge_refs(file_path: Path, skill_slug: str) -> str:
    """Returns status: 'appended' / 'merged' / 'skipped' / 'already_complete'"""
    content = file_path.read_text(encoding="utf-8")

    shared_url = SHARED_LINK[1]

    # 已有共享链接 → 跳过（可能已手动升级）
    if shared_url in content:
        return "already_complete"

    # 已有 "## 参考资料" section
    if "\n## 参考资料" in content:
        # 找到该 section 结尾，在里面追加共享链接
        # 简单策略：在文件末尾追加（append）
        lines = content.rstrip("\n").split("\n")
        # 找到 "## 参考资料" 行
        try:
            ref_idx = next(i for i, l in enumerate(lines) if l.startswith("## 参考资料"))
        except StopIteration:
            ref_idx = -1

        if ref_idx == -1:
            # 没找到，直接 append
            new_content = content.rstrip("\n") + "\n" + build_ref_section(skill_slug)
        else:
            # 在该 section 末尾插入（section 结尾 = 下一个 "## " 前 or 文件结尾）
            end_idx = len(lines)
            for i in range(ref_idx + 1, len(lines)):
                if lines[i].startswith("## "):
                    end_idx = i
                    break

            # 构造要插入的新链接
            new_links = []
            specific = SKILL_SPECIFIC_REFS.get(skill_slug, [])
            for label, url in specific:
                link_line = f"- **{label}**：[{url}]({url})"
                if link_line not in content:
                    new_links.append(link_line)

            shared_line = f"- **{SHARED_LINK[0]}**：[{SHARED_LINK[1]}]({SHARED_LINK[1]})"
            if shared_line not in content:
                new_links.append(shared_line)

            if not new_links:
                return "already_complete"

            # 插入到 section 末尾
            insert_lines = [""] + new_links + [""]
            new_lines = lines[:end_idx] + insert_lines + lines[end_idx:]
            new_content = "\n".join(new_lines) + "\n"

        file_path.write_text(new_content, encoding="utf-8")
        return "merged"

    else:
        # 没有 "## 参考资料" section，直接追加
        new_content = content.rstrip("\n") + "\n" + build_ref_section(skill_slug)
        file_path.write_text(new_content, encoding="utf-8")
        return "appended"


def main():
    root = Path(__file__).resolve().parent.parent
    skills_dir = root / "skills"

    stats = {"appended": 0, "merged": 0, "already_complete": 0, "skipped": 0}

    for skill_dir in sorted(skills_dir.iterdir()):
        if not skill_dir.is_dir():
            continue
        skill_slug = skill_dir.name
        md_file = skill_dir / "SKILL.md"
        if not md_file.exists():
            print(f"  SKIP   {skill_slug} (no SKILL.md)")
            stats["skipped"] += 1
            continue

        status = append_or_merge_refs(md_file, skill_slug)
        symbol = {
            "appended": "✨ APPEND",
            "merged": "🔗 MERGE",
            "already_complete": "✓ OK   ",
            "skipped": "⏭️ SKIP  ",
        }[status]
        print(f"  {symbol} {skill_slug}")
        stats[status] += 1

    print(f"\nDone: {stats['appended']} appended, {stats['merged']} merged, "
          f"{stats['already_complete']} already complete, {stats['skipped']} skipped.")


if __name__ == "__main__":
    main()
