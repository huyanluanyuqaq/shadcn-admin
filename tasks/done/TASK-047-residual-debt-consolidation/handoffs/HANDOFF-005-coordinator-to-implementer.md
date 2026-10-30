# HANDOFF-005 · 收尾提交（仅 M-1）

**From：** coordinator（主控位）
**To：** developer（执行位）
**Date：** 2026-10-21
**Task ID：** TASK-047
**性质：** 单一收尾动作，**不重新实施任何 WP**，不重跑全量整改

---

## 1. 依据

主控位第二轮复审判定 **PASS**，唯一合并前必修项为 **M-1**（`AC-20` 仍为 `[ ]`），
详见 `handoffs/2026-10-21-coordinator-review-round2.md` §5：

> 实测 `grep -c "^- \[ \] \*\*AC-"` = 1，唯一未勾选者即 AC-20；
> 而 AC-20 的两个条件都已满足（判据已按 R-2 改写；结果已附于 `HANDOFF-004` §6.1 的 12 行退出码表）。
> 即「**做了没勾**」，属交付完整性缺陷；合并后档案会永久留一个「门禁 AC 未勾」的自相矛盾。

---

## 2. 必做（按序，做完即止）

1. **勾选 `AC-20`**：`TASK.md:286` 的 `- [ ] **AC-20**` → `- [x] **AC-20**`，
   并在该行末尾追加一句注：
   `（主控位第二轮复跑确认：CI run 39544951231 双作业 success + 本机 lint/format/knip/test/build/audit-repo 全绿）`
   - **只改复选框与这一句注，不得改动 AC-20 的判据正文**（判据已按 R-2 定稿）。
2. **把主控位留在工作区的改动一并纳入本次提交**（**这是本次交付的一部分，不得丢弃**）：
   - `M  tasks/review/TASK-047-residual-debt-consolidation/TASK.md` —— 主控位已更新的
     `审查记录` 行（第 1 轮 CHANGES_REQUESTED + 第 2 轮 PASS）、`Handoff` 表 005 行与 `Next Action`
     （ⓐ补 M-1 → ⓑ等 CI → ⓒ人类授权后合并 → ⓓ合并后回填 Merge Record）；
   - `?? .../handoffs/2026-10-21-coordinator-review-round2.md` —— 主控位第二轮审查记录（**须入库**）；
   - `?? .../handoffs/HANDOFF-005-coordinator-to-implementer.md` —— 本派单（**须入库**）。
   > 三份合计即当前 `git status` 的全部输出；提交前请先 `git status` 确认**没有第四份**，
   > 若出现意料之外的改动项，先上报再处置。
3. `git add -A && git commit`，message 建议：
   `chore(TASK-047): 勾选 AC-20 并入库主控位第二轮复审记录`
4. `git push origin chore/TASK-047-residual-debt-consolidation`（推任务分支属执行位独占职责）。
5. 等 PR **#22** 的 `install-lint-build` 与 `audit` 两个必需检查均为 **success**，
   记录 **新 head SHA** 与 **新 run id**。
6. 写 `handoffs/HANDOFF-006-implementer-to-coordinator.md`（简短即可）：
   提交 SHA / 新 head / run id / 两检查结论 / 确认未改其它内容。

---

## 3. 严禁

- **严禁 `git checkout --` / `git reset --hard` / `git stash`** 丢弃工作区
  —— 工作区那三份改动是主控位的审查证据，丢了就得重做整轮审查。
- 不得改动 `AC-20` 以外的任何 AC 勾选状态；不得改动 `Status`（保持 `REVIEW`）、
  不得 `git mv` 换目录（已位于 `tasks/review/`，正确）。
- 不得重数提交数、不得改 `Changed Files`、不得重跑 WP-1~WP-6 的任何内容。
  （`Changed Files` 的 SHA 锚定与「以 `git rev-list --count main..HEAD` 为准」的说明已写入档案，
  本次追加提交后计数自然变化，**不需要**回头改档案 —— N-4 已确认为刻意锚定。）
- 不得代写任何主控位署名文件；不得自行合并、不得自判 PASS。
- 若 `git push` 被拒（HD-2：`gh` 无 `workflow` scope / SSH 异常）⇒ **立即停工上报**，
  不得网页手改绕过 PR 门禁。

---

## 4. 环境陷阱（本机实测，务必绕开）

| 现象 | 处置 |
|---|---|
| `pnpm build` 报失败 | 多半是 safe-delete 守卫拦截清空 `dist` ⇒ 先 `mv dist /tmp/…` 再跑 |
| `pnpm test` 报失败 | 先 `mv node_modules/.vite /tmp/…` 再跑 |
| 退出码失真 | `pnpm` 偶发调 `wmic.exe` 被拦 ⇒ **以输出末尾 `Tests N passed` 为准**，别信退出码 |

本次**不需要**重跑全量门禁（CI 会跑）；若要本地自证，按上表执行。

---

## 5. 完成判据

- [ ] `TASK.md` 中 `- [ ] **AC-20**` 计数为 **0**，`- [x] **AC-20**` 存在且带注
- [ ] `2026-10-21-coordinator-review-round2.md` 与 `HANDOFF-005-…md` 均已入库（`git ls-files` 可见）
- [ ] 分支已推 origin，PR #22 head 已更新
- [ ] PR #22 两必需检查 success，run id 已记入 HANDOFF-006
- [ ] 工作区干净（`git status` 无未提交/未跟踪项）
