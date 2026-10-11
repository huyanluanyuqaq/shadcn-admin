# HANDOFF-001 — developer → human(review)

> 本文件记录 TASK-016 的交接。任务已实现并验证完毕，等待人类审查后决定是否合并 main。

---

## Meta

```yaml
From: workbuddy (developer)
To: human (review)
Task: TASK-016 — 客户表单流量上限自动填充优先级（套餐 → 订阅信息 → 手动）
Date: 2026-10-11
Current State: REVIEW
Previous Handoff: 无（首个交接）
```

---

## Completed Work

- 在 `src/features/customers/data/schema.ts` 新增纯函数 `resolveAutoTrafficGb(planTrafficLimit, subscriptionTraffic)`：
  返回 GB 字符串（'' 表示无来源）；套餐月流量优先于订阅信息流量；0 与 null/undefined
  一视同仁视为无来源；GB 换算与 `toCustomerForm` 同口径（`Number((bytes / GB).toFixed(2))`）。
- 重构 `src/features/customers/components/customers-action-dialog.tsx`：
  - 上移订阅匹配派生（`subscriptionItems` / `matchedSub` / `subscriptionUrl` watch / `urlMatch`），
    使其位于月流量自动填充 effect 之前；
  - 新增 `urlPreview` state（按链接键控：`{ url, traffic }`），「拉取订阅更新」的预览流量
    由此进入自动填充来源；链接被修改后预览值自然失效（派生比较，无 effect 重置，
    规避 `react-hooks/set-state-in-effect` lint 规则）；
  - 月流量自动填充 effect 由「仅套餐」改为三级优先级链：
    手动填写（守卫，永不覆盖）> 套餐月流量（订阅链接被使用时高优先级）> 订阅信息流量（默认）；
  - 「使用」按钮（`applySubscription`）改链接后经 `urlMatch` 自动纳入订阅信息流量，无需额外接线；
  - 月流量字段补优先级提示文案；移除不再使用的 `GB` 导入。
- `src/features/customers/data/schema.test.ts` 新增 `resolveAutoTrafficGb` 6 组单测
  （双空 / 仅套餐 / 仅订阅信息 / 双有套餐胜 / 0 值 / GB 小数换算）。
- `docs/architecture/overview.md` §5 新增「客户表单流量上限自动填充优先级（TASK-016）」说明表。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| src/features/customers/data/schema.ts | 修改 | 新增 `resolveAutoTrafficGb` 纯函数 |
| src/features/customers/components/customers-action-dialog.tsx | 修改 | 订阅信息流量来源 + 优先级自动填充 + 提示文案 |
| src/features/customers/data/schema.test.ts | 修改 | `resolveAutoTrafficGb` 6 组单测 |
| docs/architecture/overview.md | 修改 | §5 流量上限优先级说明 |
| tasks/active/TASK-016-traffic-limit-priority/TASK.md | 新增 | 任务定义 |
| tasks/active/TASK-016-traffic-limit-priority/handoffs/HANDOFF-001-*.md | 新增 | 本文件 |

---

## Tests

```yaml
命令: pnpm test / pnpm build / pnpm lint / pnpm format:check
结果: 全部通过（test 182/182，16 文件；build tsc -b + vite build ✓；lint ✓；format:check ✓）
覆盖: resolveAutoTrafficGb 全部优先级分支；既有客户 schema 39 例回归
未覆盖: 对话框 effect 链的组件级行为（本项目 customers 模块无组件测试先例，
        沿 TASK-014 同口径以代码走查 + 纯函数单测验证）；真实浏览器点击流未跑
        （沙箱无登录态实例，3000 实例为 tsx watch 可人工复核）
```

备注：`pnpm knip` 在干净 main 树上同样失败（22 个既有未用文件/导出），非本次回归；
新导出 `resolveAutoTrafficGb` 已被对话框使用，未被 knip 列入。
`pnpm build` 前需 `rm -rf dist`（sandbox safe-delete 拦截 vite prepare-out-dir 清空，
既有已知问题，见工作区记忆）。

---

## Known Issues

- 无（本次范围内）。

---

## Remaining Work

- 无（实现与验证已完成，等待人类审查）。

---

## Assumptions

- 「订阅面板」= 客户表单（含「订阅信息」「订阅链接」两部分）；「流量上限值」= 第二部分
  的**月流量（GB）**字段（`trafficMonthlyGb` → `customers.traffic_total`）。
  判据：「手动设置的流量上限」字段仅存在于客户表单；三级来源（套餐 / 订阅信息 / 手动）
  也仅在客户表单同时存在。
- 「订阅链接被使用」= 表单链接匹配到订阅管理记录（`urlMatch`）或经「使用」按钮应用、
  或已「拉取订阅更新」预览。此时候选来源（套餐月流量与订阅信息流量）才同时存在，
  套餐月流量胜出；无链接时套餐月流量仍自动填充（保持既有行为，"新增"为增量语义）。
- 预览流量只参与**月流量**自动填充，不写回第三部分「订阅流量上限（GB）」——
  该字段的语义是「保存时同步到订阅管理的值」，避免预览值污染订阅自身属性。

---

## Risks

| 风险 | 影响 | 缓解 |
|------|------|------|
| 对「订阅链接被使用」的判定与用户原意有偏差 | 优先级链触发条件不符预期 | 语义已写入 TASK.md Task Rules 与架构 §5 说明表；如不符可按说明表定位修改点（仅涉 `subscriptionTraffic` 一行派生与 effect） |
| 月流量被自动填充后用户改套餐不会刷新（既有守卫语义） | 需手动清空再选 | 与既有行为一致，未扩大改动面；提示文案已说明自动填充规则 |

---

## Next Action

人类审查 `git diff main..feat/TASK-016-traffic-limit-priority`（4 个提交：
feat(web) / test / docs / docs(task)），重点核对 `subscriptionTraffic` 派生与
月流量自动填充 effect 的优先级语义；通过后在 3000 实例（tsx watch 已热加载）
人工复核三个场景：① 编辑有匹配订阅客户 ② 点「拉取订阅更新」③ 点「使用」。

---

## References

- 任务定义：`tasks/active/TASK-016-traffic-limit-priority/TASK.md`
- 架构说明：`docs/architecture/overview.md` §5「客户表单流量上限自动填充优先级（TASK-016）」
- 关联：TASK-013（流量阈值，`effectiveTrafficTotal` 口径，已在 main）
