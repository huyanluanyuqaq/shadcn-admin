# HANDOFF-001 — 主控位 Coordinator → 执行位 Implementer

---

## Meta

```yaml
From: 主控位 Coordinator
To: 执行位 Implementer
Task: TASK-049 — 订阅管理搜索支持按客户名称搜索
Date: 2026-10-24
Current State: READY
Previous Handoff: 无（首个交接）
```

---

## Completed Work

> 主控位已完成的部分（你**不需要**重做，但你**需要**复核其结论）。

- [x] **全链路侦查（main `d229ce1`，2026-10-24 实测）**：
      前端 `subscriptions-table.tsx:65`（防抖 300ms）→ `:67-77`（`q` 入参）→
      `api.ts:54-72`（拼查询串）→ 服务端 `resources.ts:110`
      （`searchCols: [subscriptions.name, subscriptions.url]`）→
      `crud.ts:150-154`（`like` OR 拼接）。**客户名称不在任何一环的匹配范围内。**
- [x] **缺口定位**：现有「绑定客户」筛选器是精确单值匹配（`api.ts:65` 注释自述
      多选仅首个生效），无名称片段模糊查找入口。
- [x] **设计定稿**（参考实现已写入 `TASK.md` Implementation Plan 第 3/4 步）：
      `CrudOptions` 增可选 `searchCondition?: (keyword: string) => SQL | undefined`，
      订阅路由用 drizzle `exists()` 关联子查询匹配 `customers.name`。
- [x] **依赖可用性实测**：`node -e` 验证 drizzle-orm 0.45.4 导出
      `exists` / `sql` / `and` / `like` 均为 function；`resources.ts` 已导入
      `customers` 表与 `db` 实例，无需新增 import 源。
- [x] **环境事实核对**：`vite.config.ts` 的 vitest `exclude` 已含 `**/dist/**`
      （TASK-047 修复），测试计数不会因编译产物虚高；冒烟脚本的 TASK-021
      jobs 断言要求服务端**保持调度器启用**（`ENABLE_SCHEDULER=false` 会使其失败）。
- [x] **编号占用实测**：`find tasks -maxdepth 2 -name "TASK-0*"` ——
      `backlog/`、`active/` 为空；`review/` 为 TASK-047/048（D13-C 待回填）；
      `done/` 为 001–048（045 双编号为 HD-1 白名单）。**TASK-049 无冲突。**

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `tasks/backlog/TASK-049-subscription-search-customer-name/TASK.md` | 新增 | 任务档案（唯一事实来源） |
| `tasks/backlog/TASK-049-subscription-search-customer-name/handoffs/HANDOFF-001-coordinator-to-implementer.md` | 新增 | 本文件（指派命令） |

> 主控位**未改动任何被本任务管辖的文件**（`server/**`、`src/**`、`docs/**` 零变更）。
> 以上两个文件**不入库单独提交**——按 KI-11 随你的实现同批提交（见 Task Rules 第 3 条）。

---

## Tests

```yaml
命令: 未运行（设计阶段产物，零代码变更）
结果: 不适用
覆盖: 不适用
未覆盖: 全部验证留待你按 AC-1 ~ AC-7 实施
```

---

## Known Issues

- **跨仓无关**：本任务全部改动位于 shadcn-admin 仓库内，不触碰 Workspace 侧文件。
- **`or()` 恒真风险**（设计层面已防）：若 `searchCondition` 的关联条件写错
  （如漏掉 `eq(customers.id, subscriptions.customerId)`），症状是「搜索永远返回全表」。
  正向用例发现不了——AC-2 的负向用例（不存在的关键字 → total 0）是唯一廉价反证，
  **不得跳过**。
- **placeholder 断言陷阱**（框架既有教训）：占位文案若与校验提示同文，文本断言恒真。
  前端测试必须读 `input` 的 `placeholder` **属性**，不得用文本包含匹配。

---

## Remaining Work

按 `TASK.md` Implementation Plan 执行，全部 AC 均未开始：

- **Phase 0**：基线复核（`git fetch` / rev-parse / status）→ 领取（建分支 +
  任务移入 `active/` + Meta 补 Owner/Branch）。
- **Phase 1**：后端——`crud.ts` 钩子 + `resources.ts` 订阅路由 `searchCondition`。
- **Phase 2**：前端——placeholder 文案 + 测试两组断言。
- **Phase 3**：冒烟两项 + 文件头覆盖说明；api-contract 一行。
- **Phase 4**：静态门禁 + 审计 + 工作区清洁自证；档案回填；交付 Handoff；
  推送分支、开 PR，**停下**。

---

## Assumptions

> 以下是主控位做出的假设。**若某条不成立，立即停下上报，不要自行调整范围。**

1. **`main` 仍为 `d229ce1`**（2026-10-24 实测）。开工先 `git fetch` 复核；
   若已推进，按新 head 为基线，**不得**因此改变验证方法。
2. **无并行任务争用**（`backlog/` / `active/` 为空，2026-10-24 实测）。
   若领取时发现他人占用 `crud.ts` / `resources.ts` / `subscriptions-table.tsx` /
   `smoke.ts`，**停下上报**，不得并行修改。
3. **冒烟快照库的管理员凭据为 `admin` / `admin123`**（`smoke.ts:29-30` 默认值，
   TASK-043 起按此 pattern 跑通）。若快照库密码不同导致登录失败，**如实上报**，
   不得改脚本默认值迁就。
4. **`subscriptions.customerId` 为单值外键**（`schema.ts:122`，
   `integer('customer_id').references(() => customers.id)`）——`exists()`
   关联子查询因此不会产生行放大。若发现 schema 已变为多值，**停下上报**。

---

## Risks

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 改 `crud.ts` 影响 6 个资源 | 其他资源列表回归 | `searchCondition` 为可选字段，不传时行为逐字节不变；AC-3 要求冒烟**既有全部项目**通过 |
| `exists()` 条件恒真 | 搜索语义破坏（永远全表返回） | AC-2 负向用例；Code Review 时核对关联条件存在 |
| 防抖 300ms 致前端测试时序不稳定 | 单测 flaky | `vi.waitFor`（默认 1000ms > 300ms）；先落 AC-4 再动其他 |
| 冒烟服务端误设 `ENABLE_SCHEDULER=false` | TASK-021 既有 jobs 断言失败，误判为回归 | Task Rules 第 2 条明令保持启用；失败时先查启动参数再查代码 |
| 行尾/格式问题（本机 Windows） | `format:check` 本机红 | `.gitattributes` 已统一 `eol=lf`；提交前跑 `prettier --check` 自证 |
| 任务档案单独提交产生无谓 head | 历史噪声、无限回归 | KI-11：与实现同批提交，不新开「入库专用」交接 |

---

## Next Action

**接收方（执行位）的第一个具体动作，按序执行：**

1. 读完 `tasks/backlog/TASK-049-subscription-search-customer-name/TASK.md`，
   重点是 Background 的现状链路、Implementation Plan 的参考实现、
   以及 AC-2 的负向判据。

2. 执行 **基线复核**，记下原始输出：

   ```bash
   cd E:/NDLDSN-WORKSPACE/projects/shadcn-admin
   git fetch origin
   git rev-parse main origin/main      # 期望 d229ce1（两处）
   git status --short                  # 期望为空
   ```

3. 若基线一致 ⇒ `git switch main && git pull --ff-only`，然后：

   ```bash
   git switch -c feat/TASK-049-subscription-search-customer-name
   ```

   同时把任务目录移入 `tasks/active/`，`TASK.md` 的 `Status` 改 `ACTIVE`，
   Meta 补 `Owner` / `Owner Since` / `Branch`。

4. 进入 Phase 1（后端两步），完成后**先跑** `pnpm --filter server typecheck`
   再进 Phase 2。

> **不得跳过第 2 步。** 全部设计结论（行号、searchCols 内容、drizzle 导出）
> 均以 `d229ce1` 为实测基线；head 推进后行号可能漂移，须以当次 `git show` 复核。

---

## References

- 任务档案：`tasks/backlog/TASK-049-subscription-search-customer-name/TASK.md`（唯一事实来源）
- 后端工厂：`server/src/lib/crud.ts`（`CrudOptions` `:23-53`；列表关键字条件 `:150-154`）
- 订阅路由：`server/src/routes/resources.ts:104-130`（`searchCols` 在 `:110`）
- 前端表格：`src/features/subscriptions/components/subscriptions-table.tsx`
  （防抖 `:65`；入参 `:67-77`；placeholder `:189`）
- 前端 API：`src/features/subscriptions/api.ts:21-31`（`SubscriptionListParams`）、`:54-72`
- 测试范例：`src/features/subscriptions/components/subscriptions-table.test.tsx`
  的 TASK-048 段落（`:282-318`，`setupListMocks()` 复用体例）
- 冒烟范例：`server/scripts/smoke.ts:449-526`（客户/订阅创建与 byCustomer 检查；
  后缀唯一性 pattern 在 `:76`）
- API 契约：`docs/technical/api-contract.md:23`（`q` 参数行）、`:71`（订阅筛选题注）
- 体例参考：`tasks/review/TASK-048-table-page-size-100/`（最近一个 feature 任务的
  完整档案 + 交付交接，含快照库冒烟的启动参数写法）
- 规范：`AGENTS.md` §13（DoD，含否定性断言核对）、§14.2（rebase-merge 与 D13-C 回写）、
  `.agents/protocols/handoff.md`、`.agents/protocols/task-lifecycle.md`
