# HANDOFF-002 — 执行位（Implementer）→ 主控位（Coordinator / Reviewer）

> 本次交接交付**实施成果**（代码 + 测试 + 契约同步 + D13-C 第七实例回写），
> 交由主控位安排**独立审查**（AC-14）与人类授权合并（AC-13）。

---

## Meta

```yaml
From: 执行位 / Implementer（本会话）
To: 主控位 / Coordinator（**另一个会话**）
Task: TASK-041 — 客户到期时间（expireAt）改为必填
Date: 2026-10-17
Current State: REVIEW
Previous Handoff: HANDOFF-001（主控位 → 执行位，设计派遣）
Branch: refactor/TASK-041-customer-expire-required
Base: origin/main = 3d37b4a（已含 TASK-040 的合并）
```

---

## Completed Work

### 0. 前置依赖校验（档案 Dependencies 的 `blocks`）

- `gh pr view 12 --json state,mergedAt,mergeCommit` ⇒ `MERGED` / `2026-10-16T15:57:43Z` /
  merge commit `3d37b4aadc5ba3ca80ab231391c991ee1253f7fe`；
- `git merge-base --is-ancestor 3d37b4a origin/main` ⇒ 通过；
- 自 `origin/main`（= `3d37b4a`）派生 `refactor/TASK-041-customer-expire-required`。

### 1. D13-C 第七实例（TASK-040 归档回写，提交 `8062818`，footer `Refs: TASK-040`）

- `Status: REVIEW → DONE`；`git mv tasks/review/TASK-040-customer-renewal → tasks/done/`；
- **Merge Record 九项全部实查回填**（不照抄档案）：PR #12 / rebase-merge / 11 提交 /
  `merged_at 2026-10-16T15:57:43Z` / merge commit `3d37b4a` / 合并后 run `38928137184` 双绿 /
  D8 第 11 次复现（`docker.yml` 最新运行仍为 2026-10-13，本次合并未触发 Docker）/
  两轮独立审查 PASS / **11 对 SHA 映射**；
- SHA 映射**逐对实跑验证**：`git cat-file -t` 两侧均为 `commit`、`git log -1 --format=%t` 两侧 **tree 相同**、
  `git merge-base --is-ancestor <post> origin/main` 均通过；
- 修正 `TASK.md:13` 滞后括注「待独立审查后合并」；补 `Current State` 合并事实与防腐注、
  `Changed Files` 路径注记；主控位合并执行记录（附录 F）一并入库。

### 2. 共享层（提交 `b14e097`）

- `shared/src/schema/entities.ts:94`：入参 `expireAt` → `z.number({ error: '请选择到期时间' }).int()`；
- 同文件 `:108`：`customerSchema` 的 `.extend({...})` 中**显式覆写** `expireAt: z.number().int().nullable()`。

### 3. 表单层与界面（同提交）

- `src/features/customers/data/schema.ts:87`：**字段级** `.refine((v): boolean => v !== null, …)`；
- `customers-action-dialog.tsx`：占位「长期有效（留空）」→「请选择到期时间」；
  **移除**「清除到期时间」按钮；日历加 `required`；
- `customers-columns.tsx:147`：`null` 文案「长期」→「**未设置**」（D-3）。

### 4. 契约与脚本（同提交 + 提交 `0ccd79a`）

- `docs/technical/api-contract.md`：`expireAt` 行更新（**与代码同一次提交**）；
- `docs/technical/customer-renewal.md`：F13 / §3.4 / L8 各补 **1 行**跨任务注记
  （`git diff` 验证：仅有注记，原有内容一字未删）；
- `server/scripts/smoke.ts`：10 处载荷补 `FAR_FUTURE_EXPIRE_AT`（`Date.now() + 3650 * 86400000`）
  + 新增 3 条契约检查。

### 5. 测试（提交 `0ccd79a`，+11）

见下文 Tests 节。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `shared/src/schema/entities.ts` | 修改 | 入参必填 + 输出显式覆写（AC-1/AC-2/AC-3） |
| `src/features/customers/data/schema.ts` | 修改 | 表单字段级 refine + `toCustomerInput` 类型断言与注释 |
| `src/features/customers/components/customers-action-dialog.tsx` | 修改 | 占位文案 / 移除清除按钮 / 日历 `required` |
| `src/features/customers/components/customers-columns.tsx` | 修改 | `null` 文案「未设置」（D-3） |
| `src/features/customers/data/schema.test.ts` | 修改 | +5 用例；既有 `null → null` 断言加注释 |
| `src/features/customers/components/customers-action-dialog.test.tsx` | 修改 | +6 用例；3 个既有「新建保存」用例改为先选日期 |
| `server/scripts/smoke.ts` | 修改 | 10 处补远期 `expireAt` + 3 条契约检查 |
| `docs/technical/api-contract.md` | 修改 | `expireAt` 行更新（与代码同提交） |
| `docs/technical/customer-renewal.md` | 修改 | 3 行跨任务注记（仅注记） |
| `docs/technical/customer-expire-required.md` | 修改 | 回填 §11 实现结果（X1/X2、AC-5 实测、基线对照） |
| `tasks/done/TASK-040-customer-renewal/**` | 迁入 + 回写 | D13-C 第七实例 |
| `tasks/review/TASK-041-customer-expire-required/**` | 迁入 + 回填 | 本档案与 2 份交接 |

> **禁用面零改动（AC-11，以 `git diff origin/main --stat` 为空为证）：**
> `server/src/**`、`server/drizzle/**`、`src/features/subscriptions/**`、`src/components/ui/**`、
> `package.json`、`pnpm-lock.yaml`、`.agents/**`、`templates/**`。

---

## Tests

```yaml
命令: pnpm build:shared && pnpm lint && pnpm format:check && pnpm build && pnpm test
结果: 全绿 —— build:shared ✅ / lint（无输出）✅ / format:check（All matched files use Prettier
      code style!）✅ / build（✓ built）✅ / **test 27 文件 / 345 passed**（基线 334 + 新增 11）
审计: python scripts/audit-repo.py → PASS=7 FAIL=0 WARN=0
      python ../../shared/scripts/audit_framework.py → PASS=12 FAIL=0 WARN=0 SKIP=1
```

**冒烟（`pnpm --filter server smoke`，隔离环境：数据库 `VACUUM INTO` 快照 + `PORT=3002`）：**

```yaml
本分支: 133 通过 / 7 失败
基线对照（还原改动后的 main，同一隔离环境）: 130 通过 / 7 失败
失败项 diff: **逐行完全一致** ⇒ 7 项均为基线固有，与本任务无关
新增 3 条检查: 「创建客户缺 expireAt 返回 400」✓ /「更新客户传 expireAt=null 返回 400」✓ /
              「更新客户省略 expireAt 仍成功（.partial() 未失效）」✓
```

7 项基线失败集中在「富格式验证」段：`TELEGRAM_API_BASE` / `FEISHU_API_BASE` 未指向 mock
⇒ 通知未派发；以及该段创建客户时 `FOREIGN KEY constraint failed`。

**schema 行为探针（临时脚本，跑完已删）：** ① 缺 `expireAt` → `请选择到期时间`；
② `null` → `请选择到期时间`；③ 合法值通过；④ **`.partial()` 仍可调用**
（省略字段成功、显式 `null` 被拒）—— 即第一号陷阱未触发；⑤ 输出 schema 接受历史 `null` 行；
⑥ 订阅实体的 `issues` **不含** `expireAt`（未被波及）。

**新增用例（+11）：**

- 表单 schema：拒绝 `null`（文案为「请选择到期时间」）/ 接受合法 `Date` / 新建默认即无效初值 /
  过去时刻仍合法（必填只约束非空，不要求晚于今天）/ 其余可空日期字段未被波及。
- 对话框：新建未选被拦 / **历史 `null` 客户**不补填被拦 / 历史客户补填后 `mutateAsync`
  载荷含新 `expireAt` / 「清除到期时间」按钮不存在 / 日历 `required` 实测 /
  **对照组**（同页「购买时间」日历无 `required` ⇒ 再次点击会被清空）。

---

## Known Issues

- **AC-5 实测结论：`required` 生效。** 到期时间日历再次点击已选日期**不会**清空；对照组的
  「购买时间」日历（未加 `required`）**会**清空 ⇒ 差异确由 `required` 带来。
  校验兜底仍保留（`onSelect` 的 `?? null`），设计文档 §4 的「退化为校验兜底」预案**未触发**。
- **X1（实施期发现，非缺陷）TypeScript 5.5 推断类型谓词**：`.refine((v) => v !== null)` 会把输出
  类型收窄为 `Date`。已用显式返回类型注解 `(v): boolean =>` 规避，输出保持 `Date | null`。
- **X2（实施期发现，非缺陷）`toCustomerInput` 的类型冲突**：入参必填后返回类型收紧。
  运行时**保留** `null → null` 的防御性映射（§7.1 要求），加类型断言与注释说明其不再由表单触达。
- **L1–L5 维持原状**（已披露的接受项，未当作缺陷修）：历史客户编辑必须补填 / 保证止于 API 层 /
  输出类型与入参看似矛盾 / 订阅实体刻意不改 / 无专门服务端守卫。
- **7 项冒烟失败为基线固有**（见 Tests 节的基线对照），**未在本次改动中处置**，亦不属本任务范围。

---

## Remaining Work

- **AC-14 两轮独立审查**：由**不携带实现上下文的新实例**执行（记录另起
  `handoffs/2026-10-17-review.md`，不得写入本文件）；实现者不自我批准。
- **AC-13**：推送远端 → 创建交付请求 → CI `install-lint-build` + `audit` 双绿（run id 留痕）。
- **合并**：需**人类显式授权**（`Requires Human Approval: true`，破坏性契约变更）；
  由**主控位**执行 rebase-merge（`dual-agent-model.md` §6：合并为主控位独占）。
- **D13-C 第八实例**：本任务合并后保持 `Status = REVIEW`、留在 `tasks/review/`，
  由**下一个任务**回填 Merge Record（档案已标注）。

---

## Assumptions

1. 本系统的 `POST /api/customers` **无仓库外调用方**（ADR-005 负面第 1 条已登记）；
   仓库内调用点已穷举为冒烟脚本 10 处 + 前端表单。
2. 基线对照的 7 项失败由**环境**（mock 未启动 + 富格式段外键问题）造成，
   非代码缺陷 —— 依据是「还原改动后失败项逐行一致」，而非推断。
3. `react-day-picker@9.14.0` 的 `required` 在 `mode='single'` 下语义稳定（已实测）。

---

## Risks

| 风险 | 影响 | 缓解 |
|------|------|------|
| 审查者误把订阅实体的「长期有效（留空）」判为漏改 | 中 | Non-Scope / L4 / 本 handoff 明示；订阅 `issues` 探针实证未波及 |
| 审查者误把 7 项冒烟失败判为本次引入 | 中 | 本节给出**基线对照**与其 `diff` 为空的证据 |
| 后续读者删掉 `toCustomerInput` 的 `null` 分支断言 | 中 | 测试内已加注释锁定其为**独立契约** |
| 「提示可见」用文本查询断言 | 高（假阳性） | 占位与提示**同为**「请选择到期时间」；测试按 `data-slot="form-message"` 定位 + 行为断言 |

---

## Next Action

1. 由不携带实现上下文的新实例执行 AC-14 两轮独立审查（第 1 轮全量 + 第 2 轮定向）。
2. 关闭阻断项后，由主控位推送并创建交付请求；CI 双绿后请**人类显式授权** rebase-merge。

---

## References

- [TASK-041 档案](../TASK.md) — 范围与验收依据（唯一事实来源）
- [客户到期时间必填设计](../../../../docs/technical/customer-expire-required.md) — §11 为本次实现结果回填
- [ADR-005](../../../../docs/decisions/ADR-005-customer-expire-required.md) — 强制层级与历史数据决策
- [HANDOFF-001](./HANDOFF-001-coordinator-to-implementer.md) — 设计派遣（本次实施的依据）
- `shared/src/schema/entities.ts:94,108` — 入参与输出 schema
- `server/scripts/smoke.ts` — 新增的 3 条契约检查（搜索 `FAR_FUTURE_EXPIRE_AT` 与「8b. TASK-041」）
