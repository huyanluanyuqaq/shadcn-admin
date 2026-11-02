# 2026-11-02 主控位审查记录 — PR #28 / TASK-055

| 字段 | 值 |
|------|-----|
| **审查协作位** | 主控位（Coordinator） |
| **审查实例** | 本会话（Claude Code，Opus 5）。**会话于审查前全新开启（`/clear`），未携带任何实现上下文** |
| **被审对象** | PR [#28](https://github.com/huyanluanyuqaq/shadcn-admin/pull/28)，分支 `fix/TASK-055-archive-backfill-and-email-binding-residuals`（`main` `2ca5d50` → `36a3f19`，2 提交） |
| **执行位** | Codex（developer） |
| **结论** | **FAIL（CHANGES_REQUESTED）** —— 1 个 MAJOR + 1 个 MINOR + 2 个 NIT |

---

## 0. 独立性声明（Task Rules 要求）

TASK-055 的 `## Task Rules` 要求「本任务含代码改动（C 组），主控位复审之外，**还须由不携带实现上下文的
独立实例**复核 C 组的 404 语义与 D 组报告的真实性」。

- 本会话在审查开始前全新开启，**未读任何实现过程的中间产物**，首次接触即 `HANDOFF-001` + 实际 diff；
- C 组 404 语义与 D 组真实性均由本会话**独立复现**（见 §2 / §3），未采信执行位的结论陈述；
- **但须如实标注**：本仓库为单一平台身份，按 `.agents/protocols/dual-agent-model.md` §5.2
  与 `docs/operations/github-capability.md`，「实现者 ≠ 批准者」**无平台强制**，
  独立审查是**流程约定**。本次审查满足「不携带实现上下文」这一条，但不构成平台级独立保证。

---

## 1. 逐条 AC 核验

| AC | 结论 | 核验方式（全部由本会话实跑） |
|----|------|------------------------------|
| AC-1 | ✅ 满足 | `gh api .../pulls/26` → 14 commits / `2026-10-31T12:04:52Z` / `e563800…`；`actions/runs?head_sha=e563800…` 三条 run 中 `41202023831` 为 `head_branch=v1.0.7` 的发布 run、`41199514198` 为合并 run，档案内区分说明与实测一致 |
| AC-2 | ✅ 满足 | 052 档案九要素齐全；`main` 上原表确为 6 字段旧格式（已比对 `git show main:…`），「补齐」声称属实 |
| AC-3 | ✅ 满足 | `grep` 命中原文「同一文件内含两节：首轮 **FAIL** + 第二轮复核 **PASS**」；053 的 `handoffs/2026-11-02-review.md` 确有 FAIL / PASS 两节 |
| AC-4 | ✅ 满足 | `grep -c "无 AC 加严级"` = **1**；旁及（053 独立实例顺带指出 bundle 判重缺陷）已写明 |
| AC-5 | ✅ 满足 | `tasks/done/TASK-05[1-4]*` = 4、`tasks/review` 目录树 = 0；`git diff --name-status -M` 全部为 `R`（`git mv`，非 rm+新建）；四份 `Status: DONE` |
| AC-6 | ✅ 满足 | 三份档案各 **9** 行映射；本会话逐条复跑：9 个旧 SHA `git merge-base --is-ancestor <旧> main` **全部返回非 0**，9 组**新旧 tree 全同**，9 组标题逐字一致 |
| AC-7 | ❌ **不满足（见 M-1）** | 断言本身全部通过、脚本 62/62 exit 0，但**该测试不具区分力**：用 `main` 的 `resources.ts` 跑同一脚本，结果**同样是 62/62 exit 0** |
| AC-8 | ✅ 满足 | 本会话按档案配方以隔离快照库实跑 smoke：**168 通过 / 14 失败，退出码 1**；`✓ 同一邮箱在未指定供应商下可单独绑定（NULL 互异）` 实测通过。但**分簇计数有误**（见 m-1） |
| AC-9 | ✅ 满足 | 只读连接 `server/data/app.db`：四表 `4 / 6 / 0 / 6`，两条查询均 `[]`，`app.db` mtime 仍为 `2026-11-01 22:12:43`（未变）；vacuous 标注已写入档案与 Known Issues |
| AC-10 | ✅ 满足 | 本会话全量复跑，退出码与数字**逐项吻合**：sync 62/0 `0`；bundle 68/0 `0`；vitest **27 文件 / 345 用例** `0`；`tsc -b` `0`；`eslint .` `0`；`prettier --check .` `0`；`knip` `0`；`audit-repo.py` **PASS=9 FAIL=0 WARN=0** `0`；`build:shared` `0`；`typecheck:server` `0` |
| AC-11 | ✅ 满足 | 「本次未做」8 项与 Non-Scope 逐条对应；第 4/5 项显式标注「未列于 Non-Scope」/「File Scope 许可的备选方案」，非静默遗漏 |

**平台侧**：PR #28 两个必需检查（`install-lint-build` / `audit`）均 **pass**。

---

## 2. 问题清单

### M-1（MAJOR，阻断）— C 组回归测试不具区分力，AC-7 的证据不成立

| 项 | 内容 |
|----|------|
| **位置** | `server/scripts/email-binding-sync-check.ts`「场景 12」（PR 提交 `36a3f19`） |
| **现象** | 场景 12 的请求体只有 `{ email: 'owner@x.com' }`，**未带 `poolId`**。由于目标行不存在，`beforeWrite` 里 `poolId = 'poolId' in values ? … : (current?.poolId ?? null)` 解析为 **`null`**，判重查询因此按 `pool_id IS NULL` 查找；而种子绑定写的是非空 `pool_id`，**永远匹配不上**。于是即使没有本次修复，`beforeWrite` 也直接放行，CRUD 自己返回 404 |
| **实测证据** | 本会话把 `server/src/routes/resources.ts` 换成 `main` 版本（隔离副本，未改动工作树），跑**完全相同的已提交脚本**：<br>`[email-binding-check] 通过 62 / 失败 0`，退出码 **0**，场景 12 七项断言**全绿**<br>—— 与修复后的结果**逐字节相同** |
| **期望** | 请求体应携带撞车的 `poolId`：`{ email: 'owner@x.com', poolId }`。本会话实测该变体：<br>• `main` 版本 → **409**，「状态码为 404」「message 为邮箱绑定 不存在」两项**失败**（60/62）<br>• 修复版本 → **404**，62/62 全过<br>即加一个字段后，测试才真正能挡住「删掉 `if (id !== null && current === null) return null`」这类回退 |
| **后果** | 脚本注释「邮箱撞上 owner@x.com（同供应商），足以在旧代码里触发 409」是**错的**；AC-7 声称的「新增用例断言状态码 + 行数两项…全过」只证明脚本能跑，**没有证明缺陷被修掉、也没有证明它被守住**。未来任何重构移除这 4 行，门禁依然全绿 |
| **修复方向** | 场景 12 的 `patchJson` 入参补 `poolId`（种子行的那个）。其余 5 项断言与 3 项对照组无需改动（实测在两种代码下均通过） |

> **须与 M-1 分开评价**：修复本身（`if (id !== null && current === null) return null`）是**正确且有效**的 ——
> 在上述带 `poolId` 的用例下，它确实把 409 变成了 404，且不影响创建路径（`id === null` 不走该分支）、
> 不削弱 409 判重（对照组 3 项在两种代码下均通过）。问题**只在测试的构造**，不在实现。
> 修复位于 `resources.ts`、未动 `crud.ts`，符合 Task 规定。

### m-1（MINOR，需同轮改正）— smoke 14 项失败的分簇计数错误

| 项 | 内容 |
|----|------|
| **位置** | `tasks/active/TASK-055-…/TASK.md`「V 组实测记录」、`HANDOFF-001`、PR #28 描述三处 |
| **现象** | 三处都写「流量阈值通知 **7 项** + 仪表盘 stats 1 项（共 8）/ 邮箱绑定 sync **5 项** / 备份恢复标记 1 项」 |
| **实测证据** | 本会话独立实跑 smoke（隔离快照库），14 项 `✗` 逐条归属为：<br>• 流量阈值 **6 项**（A 穿越 50% / A 停留 60% / A 穿越 80% / A 回落 30% / A 重置后再穿越 / B 跳 95%）+ 仪表盘 stats **1 项** = **7**<br>• 邮箱绑定 sync **6 项**（创建绑定 / 改绑 / 同邮箱跨供应商 / 清理陈旧绑定 / 仅剩一条绑定 / 按 poolId 筛选）<br>• 备份恢复标记 **1 项**（19.17）<br>合计 **14** |
| **影响** | 总数 14 与「全部先于本任务存在」的结论**都正确**，错的是两簇之间各偏移 1 项。危害在于：后续若按「sync 5 项」立项清理，会**漏掉 1 项**；该档案是此类断言的唯一事实来源 |
| **修复方向** | 三处同步改为 6+1 / 6 / 1，并附本次实测的失败清单 |

### NIT-1 — Workspace 级 `projects/README.md` 任务快照已过期

`projects/README.md` 的「当前任务」段仍写 `tasks/done/` 46 个、`tasks/review/` 1 个（TASK-047）、
`tasks/active/` 空。实测现为 **done 54 / review 0 / active 1（TASK-055）**。
该段带有明确时点标注（「2026-10-21 合并后复测快照」），且 `projects/README.md` **不在 TASK-055 的
File Scope 内**，故**不构成本 PR 缺陷**；登记为后续维护项，建议在 TASK-055 合并后的独立小 PR 中更新。

### NIT-2 — TASK-051 回填时删除的机制说明里含一条「不得伪造」条款

`git show main:tasks/review/TASK-051-…/TASK.md` 的 Merge Record 机制说明原有：
「无合并前独立审查档时，『审查记录』行须如实写『无（A3 断档）』，**不得补写、不得伪造**」。
该句随机制说明被替换为实测值而消失（内容仍存于 git 历史，且 TASK-055 的 Task Rules 有等价约束）。
无实际风险，仅提示：回填类改动宜把这类禁令**保留在表旁**，而不是只留在历史里。

---

## 3. 受保护规则与边界符合性

| 检查项 | 结论 |
|--------|------|
| `server/src/lib/crud.ts` 未改 | ✅ `git diff` 无该文件 |
| `server/src/db/**` 未改 | ✅ |
| 16 个历史 `handoffs/*.md` 零改动 | ✅ `git diff -M --summary` 16 条 rename 全部 **100%** 相似度，内容零改动 |
| `tasks/done/TASK-001~050` 未改 | ✅ |
| `.github/**` / `.agents/**` 未改 | ✅ |
| `scripts/audit-repo.py` 及其豁免清单未改 | ✅ 现跑 `PASS=9 FAIL=0 WARN=0`；F8 豁免 25 条、F9 白名单仅 HD-1（TASK-045 双目录），与既有记录一致 |
| 未削弱受保护规则 | ✅ 未见放宽 AC、未见伪造检查、未见绕过门禁 |
| 档案移动用 `git mv` | ✅ 全部为 rename |
| 真实库只读 | ✅ 本会话核查前后 `app.db` mtime 与四表行数均未变 |
| 提交 footer `Refs: TASK-055` | ✅ 两个提交均有 |
| 执行位未自行批准 / 未合并 | ✅ PR 仍 OPEN，无自审声明 |
| File Scope | ✅ 改动文件全部在声明范围内；`dirty-data-audit.ts` 已按许可备选方案删除，knip 复跑 `0` |

---

## 4. 整改要求（可执行、可验证）

1. **【M-1】** 把场景 12 的请求体改为 `patchJson('/email-bindings/999999', { email: 'owner@x.com', poolId })`，
   并修正该处注释（删去「同供应商」的错误表述，改为「携带撞车的 `poolId`，否则判重会按 `pool_id IS NULL`
   查找而匹配不上种子行」）。
   **验收**：① 修复代码下 62/62 exit 0；② **把 `resources.ts` 暂存回 `main` 版本后，场景 12 的
   「状态码为 404」与「message」两项必须失败** —— 这一条是 M-1 的闭环判据，须把两次运行的原始输出
   都贴进档案。
2. **【m-1】** 三处（TASK.md / HANDOFF-001 / PR 描述）的 smoke 分簇计数改为
   「阈值 6 + 仪表盘 1 = 7 / sync 6 / 备份 1」，并附 14 项失败清单。
3. 整改后重跑 §1 的全部门禁，退出码须全为 0（smoke 仍为 1，属既有红）。
4. 在 `TASK.md` 的 `Known Issues` 增加一条：**场景 12 曾因未携带 `poolId` 而不具区分力**，
   记录成因与整改后的验证方式（防止同类「测试看似通过实则空转」再次发生）。

---

## 5. 结论与下一步

**FAIL（CHANGES_REQUESTED）。** 阻断项仅 M-1 一个，且**只需改测试的一行入参与一处注释**，
不需要改产品代码。

R / S / D 三组（四份 Merge Record 九要素、SHA 映射表、真实库只读核查）质量很高：
九要素全部由本会话用 `gh api` / DockerHub Tags API **当场复现成功**，SHA 映射 9/9 逐条可核，
vacuous 与「合并未推进 latest」两处容易被误读的地方都主动写明了。这些**不需要整改**。

**Next Action：**
1. 执行位按 §4 整改（M-1 + m-1 + Known Issues 增补），重跑全量门禁，把两次对照运行的原始输出贴进档案；
2. 推送新提交到同一分支（PR #28 自动更新）；
3. 主控位复审，**闭环判据是 §4.1 的第 ② 小项**（main 版本下场景 12 必须失败）；
4. 复审 PASS 后由人类授权合并（合并动作属主控位/人类，执行位不得自行合并）。

> 本文件为审查记录，**未提交、未推送**：按 `.agents/protocols/dual-agent-model.md` §6，
> 「推送到任务分支」属执行位职责。请执行位在整改提交中一并纳入版本控制。
