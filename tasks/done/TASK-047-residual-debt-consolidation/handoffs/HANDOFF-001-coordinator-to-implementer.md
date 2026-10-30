# HANDOFF-001 — coordinator → developer

---

## Meta

```yaml
From: 主控位（coordinator）
To: developer
Task: TASK-047 — 遗留债务一次性收口（档案回写归档 / 制度门禁补洞 / 文档口径统一 / 代码卫生）
Date: 2026-10-21T08:35:00+08:00
Current State: READY
Previous Handoff: 无（首个交接）
```

---

## Completed Work

主控位已完成**设计与裁决收口**，本任务不含任何代码改动（当前仅新增 `tasks/**` 三个文件）：

1. **2026-10-21 只读全面审查**，实跑以下命令得出 16 项遗留发现（基线 `main` = `origin/main` = `2a4e259`，无待合并 PR，工作区干净）：
   - `git status --short --branch` / `git log --oneline` / `git ls-remote --heads origin`
   - `gh api repos/:owner/:repo/pulls/20` → `merged_at 2026-10-18T02:44:19Z`、`merge_commit_sha 604017d…`、`state closed`
   - `gh api repos/:owner/:repo/pulls/21` → `merged_at 2026-10-20T14:02:38Z`、`merge_commit_sha 2a4e259…`
   - `find tasks -maxdepth 2 -type d -name "TASK-*"` → **045 出现 2 次**、最大 046
   - `find tasks -name "*-review.md" -o -name "*-recheck.md"` → 最后命中 TASK-041，**042~046 全缺**
   - `grep -n "^## " templates/task/TASK.md` → **18 章节，无 `## Merge Record`**
   - `pnpm test` → **27 文件 / 351 用例全绿，真实退出码 0**
   - `pnpm build` → 首轮 `BUILD_EXIT=1`（safe-delete 拦 `dist`），`mv dist /tmp` 后 **退出码 0**
   - `pnpm knip` → 未使用文件 20 / 依赖 2 / 导出 33 / 类型 16
   - `python scripts/audit-repo.py` → `PASS=7 FAIL=0`；`python shared/scripts/audit_framework.py` → `PASS=12 FAIL=0 SKIP=1(A3 缺 PyYAML)`
   - `gh auth status` → 活动账号 `huyanluanyuqaq` scopes = `gist, read:org, repo`（**无 `workflow`**）
   - `wsl -e bash -lc "docker --version"` → `Docker version 29.9.0`（**Windows 宿主无 `docker`**）
2. **生成 TASK-047 档案**（452 行 → 现约 470 行）：6 个 WP、**AC-1~AC-21**、19 章节（含 `## Merge Record`，先于模板合规）。
3. **取得三项人类裁决并落进档案**（`## Dependencies` → 「人类裁决记录」，编号 HD-1/2/3）：
   - **HD-1** 历史两个 `TASK-045` **不重编** ⇒ 门禁用「白名单 + 理由 + 裁决日期」，白名单外重复必须 FAIL
   - **HD-2** **不补** `gh workflow` scope ⇒ 只把该决定落档，`github-capability.md` §7 #6 改为「已裁决不补」
   - **HD-3** **删除** `.tmp-t043` / `.tmp-t046` ⇒ 先转存关键结论，再删，最后 `ls -d` 验证

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `tasks/backlog/TASK-047-residual-debt-consolidation/TASK.md` | 新增 | 任务档案（唯一事实来源），`Status: READY` |
| `tasks/backlog/TASK-047-residual-debt-consolidation/handoffs/HANDOFF-001-coordinator-to-implementer.md` | 新增 | 本交接单 |

> 除上述两个文件外**无任何改动**（`git status` 仅 `?? tasks/backlog/TASK-047-residual-debt-consolidation/`）。

---

## Tests

```yaml
命令: python scripts/audit-repo.py && python shared/scripts/audit_framework.py --root E:/NDLDSN-WORKSPACE
结果: 通过 19 / 失败 0 / 跳过 1（A3 缺 PyYAML）
覆盖: 新档案的 10 个必需字段、占位符残留、明文密钥、工作流声明、框架资产在位、模板 10 类字段
未覆盖: 新的 WP 尚未实施，AC-1~AC-21 全部未经验证（本任务交给 developer 去满足）
```

> 另：档案行尾实测 `CRLF=0`、纯 LF（473 行），模板占位符标记零残留。

---

## Known Issues

- **KI-A（历史审查档缺口不可逆）** TASK-042~046 合并前审查未留独立文件。**禁止补写**（等同伪造），
  只允许出 `2026-10-21-coordinator-recheck.md` 并标注「事后复核」。见档案 KI-2。
- **KI-B（两个 045 并存）** `done/TASK-045-review-record-naming` 与 `review/TASK-045-docker-pipeline-hardening`
  同为 `Task ID: TASK-045`。**HD-1 已裁决不重编**，用白名单共存。见档案 KI-3。
- **KI-C（D13-C 深度已超限）** TASK-045 的回写本应由 TASK-046 承载，未做且已合并 ⇒ 深度 2。
  本任务 WP-1 一次性补两笔，**是终止累积的唯一机会**。
- **KI-D（本任务自身仍会产生一笔新债）** 本任务合并后其 `Merge Record` 由下一个任务回填（KI-1）。
  是否修订 D13-C 规则**未在本次裁决范围内**，实施时**不得擅自改 D13-C**。

---

## Remaining Work

WP-1 ~ WP-6 全部 21 条 AC 待实施，详见 `TASK.md` 的 `## Implementation Plan` 六阶段。
建议顺序：**WP-1（归档）→ WP-2（门禁）→ WP-3（文档）→ WP-4（CI）→ WP-5（卫生）→ WP-6（复核）**。

---

## Assumptions

1. 执行位在本机同一工作区作业，可直接看到未跟踪的 `tasks/backlog/TASK-047-.../`。
2. `gh` 走 **SSH** 协议推送（`gh auth status` 实测 `Git operations protocol: ssh`），
   故 HD-2「不补 workflow scope」不阻塞改 `.github/workflows/**`。
3. 两 PR 的提交数、run id 以**阶段 0 实测**为准，档案里的数字是参考值（可能含档案自述误差）。

---

## Risks

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `pnpm build` 假失败（safe-delete 拦 `dist`，74 文件 > 阈值 50） | 误判为代码损坏，浪费排查时间，甚至去「修」不存在的 bug | 跑前先 `mv dist /tmp/dist-$$`；判据 = 退出码 + 输出双看 |
| `pnpm` 调 `wmic.exe` 被安全策略拦，退出码失真 | 误判测试失败（实测 `pnpm test` 显示 failed 但 351 用例全绿） | 以输出末尾 `Test Files / Tests` 行为准，并单独取真实 `$?` |
| 改 `.github/workflows/**` 经 HTTPS 被拒（HD-2 未补 scope） | WP-4 卡住 | 确认 SSH 推送；若被拒**立即停工上报**，不得网页手改绕过 PR 门禁 |
| 反向验证只贴 PASS、没真跑 FAIL | 门禁看起来有、实际抓不住问题（B2 藏这么久的根因） | AC-6/AC-7 必须留「造缺陷→FAIL→复原→PASS」三段输出 |
| 删除 `.tmp-*` 与代码文件不可逆 | 丢失取证材料 / 误删生产代码 | 先转存结论、先 `mv` 到 `/tmp`、禁用 `rm -rf` |

---

## Next Action

**建分支 `chore/TASK-047-residual-debt-consolidation`，然后执行档案「阶段 0 · 取证」：
用 `gh api repos/:owner/:repo/pulls/20/commits --jq 'length'` 与 `/pulls/21/commits --jq 'length'` 实测两 PR 提交数，
用 `gh api 'repos/:owner/:repo/actions/runs?head_sha=<SHA>'` 实测 CI / Docker run id 与 conclusion，
把实测值先写进 `TASK.md` 的 `## Changed Files` 与临时取证记录 —— 之后再动 WP-1 的档案回写。**

---

## References

- `tasks/backlog/TASK-047-residual-debt-consolidation/TASK.md`（唯一事实来源）
- `AGENTS.md` §14.2（合并策略 rebase-merge）、§14.1（必需检查名）
- `.agents/protocols/handoff.md` §3.2（审查记录三类命名）、§4（必填字段）
- `.agents/rules/github.md` §2 / §6（D13-C 回写路径）
- `scripts/audit-repo.py`（F1~F7，本任务将加 F8/F9）
- `shared/scripts/audit_framework.py`（A1~A13）
- `docs/operations/known-pitfalls.md` §8 / §11（沙箱与 pnpm 版本坑）
- PR #20（TASK-045 合并，`604017d`）、PR #21（TASK-046 合并，`2a4e259`）
