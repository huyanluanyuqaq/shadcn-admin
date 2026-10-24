# HANDOFF-002 — 执行位 Developer → 审查位 Reviewer

---

## Meta

```yaml
From: 执行位 Implementer（claude-code / Opus 5）
To: 审查位 Reviewer
Task: TASK-049 — 订阅管理搜索支持按客户名称搜索
Date: 2026-10-24T23:40:00+08:00
Current State: REVIEW
Previous Handoff: HANDOFF-001-coordinator-to-implementer.md
```

---

## Completed Work

- **Phase 0 基线复核（原始输出）**：

  ```text
  main       = d229ce1b7fd08ccb3af9b0ed46f054d44ec5da74
  origin/main= d229ce1b7fd08ccb3af9b0ed46f054d44ec5da74
  git status --short → ?? tasks/backlog/TASK-049-subscription-search-customer-name/（仅任务档案自身）
  ```

  与主控位 Assumption 1/2 一致 ⇒ 领取：`git switch -c feat/TASK-049-subscription-search-customer-name`，
  任务目录移入 `tasks/active/`，Meta 补 `Owner` / `Owner Since` / `Branch`。

- **Phase 1 后端 · 工厂扩展**（`server/src/lib/crud.ts`）：
  `CrudOptions` 增 `searchCondition?: (keyword: string) => SQL | undefined`（含用途与求值时机注释）；
  列表处理器由 `if (keyword && searchCols.length > 0)` 改为「searchCols like 数组 + 钩子条件」
  统一 `or(...)` 后作为**单一**条件 `push` 进 `conditions`。这样既满足 OR 语义，
  又修正了「searchCols 为空时条件被整体跳过」的边际；`matches.length > 0` 兜底保证
  无任何来源时不产生恒真条件。

- **Phase 1 后端 · 订阅路由**（`server/src/routes/resources.ts`）：
  导入补 `and, exists, like`；`/subscriptions` 在 `searchCols` 之后增
  `searchCondition`，用 `exists()` 关联子查询
  （`customers.id = subscriptions.customerId` AND `like(customers.name, '%kw%')`）。
  未加任何显式类型注解——`tsc` 直接接受 `exists()` 返回值（Implementation Plan 第 4 步预留的
  类型摩擦未出现）。`customers` / `db` 均为本模块既有导入，未新增 import 源。

- **Phase 2 前端**：`subscriptions-table.tsx:189` placeholder 改为
  `'搜索订阅名称、地址或客户名称…'`；测试文件新增
  `describe('SubscriptionsTable 关键字搜索')` 两组断言（placeholder 读**属性值**、
  关键字防抖后进 `q`）。

- **Phase 3 冒烟与文档**：`smoke.ts` 在「按 customerId 筛选订阅」之后插入 AC-1 / AC-2 两项，
  文件头覆盖说明补 TASK-049 一行；`api-contract.md` 补 `q` 匹配字段一行。

- **Phase 4 定向复核**（快照库， Requirement 2/3；`smoke.ts` 无对应既有项，故手工取证）：

  ```text
  customer_id=102（zzq-cust-verify49），bound_sub_id=96（zzq-sub-verify49），orphan_sub_id=97（zzq-orphan-verify49，customerId=null）
  [q=zzq-cust-verify49]                    => total=1 ids=[96]   ← 订阅名/地址均不含该片段，命中只能来自客户名
  [q=zzq-cust-verify49&customerId=102]     => total=1 ids=[96]   ← q 与筛选叠加为 AND
  [q=zzq-cust-verify49&syncStatus=error]   => total=0 ids=[]     ← 叠加非命中筛选 → 0
  [q=zzq-cust-verify49&enabled=false]      => total=0 ids=[]
  [q=zzq-orphan-verify49]                  => total=1 ids=[97]   ← 未绑定客户仍可被自身名称命中
  [q=zzq-sub-verify49]                     => total=1 ids=[96]
  [q=zzq-nomatch-verify49]                 => total=0 ids=[]     ← 负向
  [q=zzq-]                                 => total=2 ids=[96,97] ← 多来源命中取并集（OR 不丢行）
  [q=example.com]                          => total=2 ids=[96,97] ← 既有 URL 匹配不变
  清理：bulk-delete [96,97] → {"deleted":2}；DELETE /customers/102 → {"deleted":1}；复查 q=zzq- → total=0
  ```

  定向数据已全部删除，未写入 `server/data/app.db`。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `server/src/lib/crud.ts` | 修改 | `searchCondition` 可选钩子 + 列表处理器 OR/AND 修正 |
| `server/src/routes/resources.ts` | 修改 | `/subscriptions` 传入 `searchCondition`（`exists()` 子查询） |
| `src/features/subscriptions/components/subscriptions-table.tsx` | 修改 | placeholder 体现客户名称 |
| `src/features/subscriptions/components/subscriptions-table.test.tsx` | 修改 | 新增 2 条断言 |
| `server/scripts/smoke.ts` | 修改 | 新增 2 项冒烟 + 文件头覆盖说明 |
| `docs/technical/api-contract.md` | 修改 | `q` 匹配字段一行 |
| `tasks/review/TASK-049-subscription-search-customer-name/**` | 新增 | 任务档案 + 交接（随实现同批提交，KI-11） |

---

## Tests

```yaml
命令: >
  pnpm exec vitest run --browser.headless src/features/subscriptions/components/subscriptions-table.test.tsx
结果: 通过 10 / 失败 0（改动前为 8，新增 2）
覆盖: >
  placeholder 属性值 = '搜索订阅名称、地址或客户名称…'；
  userEvent.type 输入「张三」后 vi.waitFor 断言 useSubscriptionsQuery 收到 objectContaining({ q: '张三' })
  （防抖 300ms < waitFor 默认 1000ms）。
未覆盖: >
  未覆盖「排序/筛选叠加」的前端行为——那由服务端冒烟与 API 契约承担；
  `input[placeholder]` 取文档内首个带 placeholder 的 input（工具栏搜索框），
  若将来工具栏新增第二个带 placeholder 的输入需改为更精确定位。

命令: >
  SMOKE_BASE_URL=http://127.0.0.1:3002 pnpm --filter server smoke
  （服务端：cd server && DATABASE_URL=E:/AiData/task049-snapshot.db PORT=3002
   TELEGRAM_API_BASE=http://127.0.0.1:3998 FEISHU_API_BASE=http://127.0.0.1:4000
   node --import tsx src/index.ts；快照由 better-sqlite3 VACUUM INTO 生成，调度器保持启用）
结果: 154 通过 / 7 失败（新增 2 项均 ✓；7 项失败与未改动 main 的基线逐字相同）
覆盖: >
  ✓ 按客户名称关键字搜索订阅（q 匹配绑定客户名称）
  ✓ 按不存在的关键字搜索订阅返回 0 条（防止搜索条件恒真）
  既有项无回归（含「按 customerId 筛选订阅」「自动重载：修改 cron 后 job 数不变」等）。
未覆盖: >
  q 与筛选叠加、未绑定客户排除无既有冒烟项，改由上方「定向复核」手工取证。

命令: >
  pnpm exec eslint <5 个改动源码文件>；pnpm exec prettier --check <同上>；
  pnpm exec tsc -b；pnpm --filter server typecheck
结果: 全部通过（eslint 0 告警；prettier 首轮报 test.tsx 格式，--write 后复检全绿；
  tsc -b 与 server typecheck 均无输出即无错误）
覆盖: 5 个改动源码文件全覆盖（prettier 首轮告警已修复并复检）
未覆盖: 无

命令: python scripts/audit-repo.py
结果: PASS=9 FAIL=0 WARN=0（F1–F9 全 PASS，本机 PyYAML 可用，无 SKIP）
覆盖: 框架一致性审计（含 AGENTS.md §14.1 必需检查作业名与工作流实际名一致）
未覆盖: 无

命令: git status --short；git diff --check
结果: >
  status 仅含 6 个 File Scope 内改动文件 + tasks/active/TASK-049-.../（任务档案）；
  无 dist 污染、无临时文件。git diff --check 无输出（行尾/空白无问题）。
覆盖: AC-7
未覆盖: 无
```

---

## Known Issues

1. **存量失败：冒烟流量阈值段 7 项在未改动 `main` 上同样红**（详见 `TASK.md` Known Issues 第 1 条）。
   根因：TASK-046 人类裁决把生效上限改为 `trafficManualCap ?? 套餐月流量`，
   而 `smoke.ts:733-742` 的客户 A/B 只设 `trafficTotal` / `trafficUsed`，
   `effectiveCustomerTrafficTotal` 返回 null ⇒ 被 `continue` 跳过。
   **未修复**：修复要么改 A/B 载荷、要么按 TASK-046 语义重写该段断言，
   两者都超出本任务 File Scope 且触及 TASK-013 既有断言语义。
   ⇒ **AC-3 的「既有全部项目通过」在字面上不成立，如实记录为「基线同红、非回归」。**
2. **冒烟 happy path 依赖服务端指向 mock**：不设 `TELEGRAM_API_BASE` / `FEISHU_API_BASE`
   时会多 4 项通知派发失败。环境差异，非缺陷。
3. 本任务自身无未解决问题。

---

## Remaining Work

- 独立审查（Reviewer，新实例、不携带实现上下文）核对：
  - AC-1 ~ AC-7 逐项；
  - `crud.ts` 中 `or(...matches)` 作为单一条件入 AND 链的写法是否真的避免了
    「必须同时命中」的退化（这是本改动的核心正确性点）；
  - `searchCondition` 不传时其他 5 个资源是否逐字节不变（已由对照基线冒烟侧面支持）；
  - Known Issues 第 1 条的定性与「不修」的范围边界是否可接受。
- 人类授权合并（`Requires Human Approval: true`）。
- 合并后由**下一个任务**按 D13-C 选项 C 回填 `Merge Record`；
  在此之前本任务保持 `Status = REVIEW`、留在 `tasks/review/`。

---

## Assumptions

1. 冒烟对照采用的「同源快照 + 同启动参数」足以判定无回归：两次运行均从
   `server/data/app.db` 经 `VACUUM INTO` 生成全新快照（`VACUUM INTO` 不覆盖已存在文件，
   脚本已改为先删目标），服务端除代码外参数完全一致。
2. 7 项存量失败的根因判定依据是 `traffic-threshold.ts:90-94` 的
   `effectiveCustomerTrafficTotal(planTrafficLimit, trafficManualCap)` 两参签名与
   `smoke.ts:733-742` 的载荷字段差异，而非推测——已在**未改动 `main` 上复现同样的 7 项失败与同样的
   `{"notified":0,"rows":0}` / `count:2` 明细。
3. `subscriptions.customerId` 为单值外键（`schema.ts:122`），`exists()` 子查询不产生行放大
   （沿用主控位 Assumption 4，未发现 schema 变更）。
4. 冒烟凭据沿用 `smoke.ts:29-30` 默认值 `admin` / `admin123`，未改脚本默认值迁就环境。

---

## Risks

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `crud.ts` 为 6 资源共用 | 其他资源列表回归 | `searchCondition` 可选、不传时零差异；已用**同参数基线对照**证明其余项逐项相同 |
| `or()` 恒真 | 搜索永远返回全表 | AC-2 负向用例通过；`matches.length > 0` 兜底；另手工验证 `q=<随机串>` → total=0 |
| 基线本身是红的 | AC-3 字面不成立 | 已如实记录为「基线同红、非回归」并定位根因到 TASK-046 语义漂移，未假装通过 |
| `input[placeholder]` 定位 | 将来工具栏新增输入会使断言误取 | 已在 Tests 未覆盖项中注明；当前工具栏仅搜索框带 placeholder |
| LIKE 通配符 `%` / `_` | 用户输入被当通配符 | 既有行为（name/url 同理），本任务明确不处理、不计缺陷 |

---

## Next Action

**审查位第一个动作**：以不携带实现上下文的新实例运行

```bash
cd E:/NDLDSN-WORKSPACE/projects/shadcn-admin
git diff main...feat/TASK-049-subscription-search-customer-name
```

并重点核对三件事：

1. `server/src/lib/crud.ts` 的列表处理器——`or(...matches)` 是否作为**单一**条件进入
   `and(...conditions)`；若被拆成多个 `push`，AND 优先级会使语义退化为「必须同时命中」。
2. `server/src/routes/resources.ts` 的 `searchCondition`——`eq(customers.id, subscriptions.customerId)`
   关联条件是否在位（漏掉即恒真）。
3. Known Issues 第 1 条的「不修」边界是否可接受；若审查位认为应顺手修
   `smoke.ts` 阈值段，**属超范围改动，须停下上报由人类裁决**，不得自行扩大。

随后等待人类授权合并。

---

## References

- 任务档案：`tasks/review/TASK-049-subscription-search-customer-name/TASK.md`（唯一事实来源）
- 主控位指派交接：`tasks/review/TASK-049-subscription-search-customer-name/handoffs/HANDOFF-001-coordinator-to-implementer.md`
- 对照基线取证：`E:/AiData/task049-smoke-baseline.log`（main，152/7）、
  `E:/AiData/task049-smoke-branch.log`（本分支，154/7）、
  `E:/AiData/task049-smoke.log`（首次运行，未设 mock，133/11）
- 快照脚本：`E:/AiData/task049-snapshot.cjs`（`VACUUM INTO`，只读源库）
- 体例参考：`tasks/review/TASK-048-table-page-size-100/`
- 规范：`AGENTS.md` §13（DoD，含否定性断言核对）、§14.2（rebase-merge 与 D13-C 回写）、
  `.agents/protocols/handoff.md`
