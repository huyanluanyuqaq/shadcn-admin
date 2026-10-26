# HANDOFF-003 — 主控位 Coordinator → 执行位 Implementer（整改派单）

---

## Meta

```yaml
From: 主控位 Coordinator
To: 执行位 Implementer
Task: TASK-049 — 订阅管理搜索支持按客户名称搜索
Date: 2026-10-26
Current State: REVIEW（主控位第一轮审查：CHANGES_REQUESTED）
Previous Handoff: HANDOFF-002-developer-to-reviewer.md
```

---

## Completed Work

> 主控位已完成的部分（你**不需要**重做，但你**需要**知道结论已被独立核实）。

- [x] **第一轮主控位审查完结**，完整记录（含 12 项独立核实方法与结果）见
      `handoffs/2026-10-26-coordinator-review.md`。核心结论：
      - **代码零缺陷**：OR 单一条件入 AND 链、`exists()` 关联条件、参数绑定、
        可选钩子对 5 个资源的零影响——逐行读过 diff，全部正确；
      - **「基线同红、非回归」定性获认可**：7 项存量失败的根因已由主控位独立复现确认
        （`traffic-threshold.ts:90-94` vs `smoke.ts:733-742`），「不修」的范围边界认可；
      - **真实库零写入获实证**：`app.db` max id（订阅 79 / 客户 85）与任务前一致，
        无 10-24 及 `zzq-` 数据；
      - **分支轮跑在全新快照上获实证**：快照库 id 序列 80–90 / 86–99 续自真实库上限。
- [x] 结论：**CHANGES_REQUESTED**——1 项阻断（档案勾选与措辞）+ 2 项次要，
      **不要求任何代码改动**。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `tasks/review/TASK-049-subscription-search-customer-name/handoffs/2026-10-26-coordinator-review.md` | 新增 | 主控位第一轮审查记录（未入库，随你的整改提交同批提交） |
| `tasks/review/TASK-049-subscription-search-customer-name/handoffs/HANDOFF-003-coordinator-to-implementer.md` | 新增 | 本文件（未入库，同上） |

> 主控位**未改动** `TASK.md` 及任何被本任务管辖的文件——勾选与措辞修订由你执行
> （你是档案状态的维护者；审查者直接改被审档案会使「执行位维护档案」的边界失效）。

---

## Tests

```yaml
命令: 未运行（本轮回为纯档案问题，无代码变更；测试结论以第一轮审查记录第 5/6 项为准）
结果: 不适用
覆盖: 不适用
未覆盖: 不适用
```

---

## Known Issues

- 无新增。第一轮审查的 12 项核实中，**没有**发现任何代码层缺陷；阻断项全部是
  档案完整性问题（AC 复选框与 Current State 不一致）。

---

## Remaining Work

按 `2026-10-26-coordinator-review.md` 第二、三节执行，共 3 项：

1. **B-1（阻断）**：`TASK.md` 勾选 AC-1/2/4/5/6/7；AC-3 按审查记录给定的**原文照抄**
   修订为可判定措辞（含「原措辞」引用）；`Known Issues` 第 1 条补登记「AC-3 措辞
   已经主控位审查修订」这一事实。
2. **M-1（次要，仓库外）**：重命名 `E:/AiData/task049-server.log` →
   `task049-server-aborted-dirty-start.log` 并加首行注记（注记文本见审查记录 M-1）。
3. **M-2（次要）**：`Current State` 的「同快照库」改为「同源快照（各自从
   `server/data/app.db` 全新生成）」。
4. **M-3（可选）**：Handoff 表 002 行行尾补空格。
5. 在 `TASK.md` 的 Handoff 表登记**两行**：本 HANDOFF-003（`coordinator → implementer`，
   2026-10-26，「整改派单：AC 勾选 + AC-3 措辞修订 + 三处次要项」）与
   `HANDOFF-004-coordinator-to-reviewer.md`（`coordinator → reviewer`，2026-10-26，
   「I2 独立审查派单（含前置条件门槛与两轮审查范围）」）。
6. **追加一个提交**（不 amend、不强推）：信息形如
   `docs(TASK-049): 按主控位审查回填 AC 勾选并修订 AC-3 为可判定措辞` +
   `Refs: TASK-049` footer；**同批入库**本文件、审查记录与
   `HANDOFF-004-coordinator-to-reviewer.md`（I2 派单须随批入库——审查位只能从
   仓库读取它，不得只留在工作区；KI-11：不新开「入库专用」交接）。
7. 推送分支（PR #24 自动更新），**停下**，等待 I2 独立审查
   （派单已备好：审查位从仓库读 `HANDOFF-004-coordinator-to-reviewer.md` 开工，
   其第 0 步会先验证你的整改提交确已入库）。

---

## Assumptions

1. 你接受「AC-3 修订为可判定措辞并保留原文引用」这一处置。若你认为应改为
   「AC-3 保持未勾 + 标注不适用」，**先停下说明理由**，不要自行选择——
   措辞修订涉及验收标准的变更，须经主控位确认（本派单已给出确认文本，照抄即视为接受）。
2. 整改期间 `main` 无新提交影响本 PR。推送前若 `gh pr view 24` 的
   `mergeStateStatus` 不再是 `CLEAN`，**如实上报**，不要自行 rebase 后强推。

---

## Risks

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 勾选后又被发现某项证据不实 | 档案失真升级 | 12 项核实方法与原始日志路径已写入审查记录，可逐条复算 |
| 修订 AC-3 被视为「移动门柱」 | 审查公信力受损 | 原文以引用保留 + Known Issues 登记修订事实 + 审查记录留痕；且修订方向是**更严格**（明确到失败集逐字相同） |
| 整改提交夹带代码改动 | 审查范围漂移 | 本派单零代码改动要求；`git show --stat` 应只见档案与交接文件 |

---

## Next Action

**接收方（执行位）的第一个具体动作：**

1. 读 `handoffs/2026-10-26-coordinator-review.md` 第二、三节（阻断项与次要项的原文）。
2. 按 B-1 修订 `TASK.md`（AC-3 文本**照抄**审查记录所给版本，不得自行改写）。
3. 完成后自证：

   ```bash
   cd E:/NDLDSN-WORKSPACE/projects/shadcn-admin
   grep -c '^- \[ \]' tasks/review/TASK-049-subscription-search-customer-name/TASK.md   # 期望 0
   grep -n '原措辞' tasks/review/TASK-049-subscription-search-customer-name/TASK.md    # 期望有输出
   git status --short   # 应只见 TASK.md 改动 + 两个待入库的审查/交接文件
   ```

4. 追加提交并推送，然后**停下**。

---

## References

- 审查记录（含全部核实方法与判据）：`tasks/review/TASK-049-subscription-search-customer-name/handoffs/2026-10-26-coordinator-review.md`
- 你的交付交接：`tasks/review/TASK-049-subscription-search-customer-name/handoffs/HANDOFF-002-developer-to-reviewer.md`
- 后续派单（你**无需执行**，仅需随本批提交）：`tasks/review/TASK-049-subscription-search-customer-name/handoffs/HANDOFF-004-coordinator-to-reviewer.md`
- 规范：`AGENTS.md` §13（DoD：AC 复选框与交付状态一致）、`.agents/protocols/handoff.md` §3.2
