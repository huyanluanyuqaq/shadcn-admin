# HANDOFF-001-developer-to-system.md

- **From:** developer
- **To:** system
- **Task:** TASK-029 — 客户表格行点击展开延伸面板
- **日期:** 2026-10-13

---

## Current State

实现、测试全部完成。typecheck / lint / format:check 三件套全绿，
`pnpm test` 287/287 通过（改动前 251，新增 36 例）。待 Review。

---

## Completed Work

1. **周期拆分纯函数** `splitPlanCycles(purchasedAt, expireAt)`
   - 首个周期从购买日期起算
   - 每周期 = 「本月购买日 → 次月购买日的前一天」
   - 末周期不足整月时以到期时间作结束日期
   - 到期时间正好等于周期结束日时不生成空周期
   - 月末进位：**锚定购买日**（`01-31 → 02-28 → 03-31 → 04-30`），
     而非 `addMonths` 链式漂移（`01-31 → 02-28 → 03-28`）
   - `MAX_CYCLES = 1200` 防御脏数据
   - 周期起始保留购买时间的时分秒

2. **剪贴板** `src/lib/clipboard.ts`
   - 优先 `navigator.clipboard.writeText`
   - 回落到离屏 textarea + `execCommand('copy')`（自托管 http 场景
     没有 Clipboard API），并还原用户原选区

3. **延伸面板** `customer-detail-panel.tsx`
   - 可复制字段本体为 `<button>`（无独立复制按钮），hover 显示复制图标
   - 复制成功 `toast.success('已复制X')`，失败 `toast.error('复制X失败')`
   - 购买/到期时间用 `ReadOnlyField`（普通 span，不可复制）
   - 周期列表 `<ol>` + 序号，末周期标注「（不足整月）」
   - 缺失字段统一 `-` 占位且不生成按钮

4. **表格交互** `customers-table.tsx`
   - `expandedId: string | null` 单一状态
   - `toggleRow()`：互斥选中 + 切换展开（同一行再点则收起）
   - 面板行常驻 DOM，`grid-rows-[0fr]↔[1fr]` + `overflow-hidden` 过渡
   - 主行 `cursor-pointer`、`tabIndex=0`、Enter/Space 可触发

5. **冒泡隔离** `customers-columns.tsx`
   - 勾选框与行操作菜单外包 `div` + `stopPropagation`
   - 行操作菜单经 Radix portal 渲染，事件仍沿 React 树冒泡，必须在此截断

---

## Tests

| 文件 | 例数 | 覆盖 |
|------|------|------|
| `src/features/customers/utils.test.ts` | 18 | AC-4/5/6/7：周期算法全部边界 |
| `src/features/customers/components/customer-detail-panel.test.tsx` | 12 | AC-1/2/3/7：复制、只读、占位 |
| `src/features/customers/components/customers-table.test.tsx` | 6 | AC-8/9/10：展开状态机与选中 |

全量：`pnpm test` → **287/287 通过**

---

## Assumptions

1. 「月末进位」按**锚定购买日**口径实现（见 TASK.md §Design Decisions）。
2. 点击行做**互斥选中**；批量多选继续使用勾选框。
3. 面板行始终留在 DOM 中以保证收起动画；因而在 DOM 层面
   「存在」不等于「可见」，断言基于 `data-state`。

---

## Risks

| 风险 | 影响 | 缓解 |
|------|------|------|
| `grid-rows-[0fr]→[1fr]` 动画依赖较新浏览器（Chrome 107+） | 老浏览器退化为瞬时切换，功能不受影响 | 无功能风险 |
| 行点击与行内交互元素共存 | 可能误触发展开 | 已在勾选框/操作菜单处 `stopPropagation`，并有 AC-10 测试 |

---

## Remaining Work

无（交付已完成：已提交推送并 fast-forward 合入 main）。

---

## Next Action

无。遗留：端到端冒烟未跑（需后端 + mock 上游环境），离线单测已覆盖全部周期分支与展开状态机。
