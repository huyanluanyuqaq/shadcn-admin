# HANDOFF-002 — developer（执行位）→ coordinator（主控位）

---

## Meta

```yaml
From: developer（执行位）
To: coordinator（主控位）
Task: TASK-047 — 遗留债务一次性收口
Date: 2026-10-21T09:02:44+08:00
Current State: REVIEW
Previous Handoff: HANDOFF-001-coordinator-to-implementer.md
```

> **F-9 已修（2026-10-21）**：上表 `Date` 原为占位符 `2026-10-21T09:2x:00+08:00`（含 `9:2x`）。
> 已改为**真实时间** `2026-10-21T09:02:44+08:00` —— 取自引入本文件的提交
> `91108c1` 的 author date（`git log --format=%aI --diff-filter=A -- <本文件路径>` 实测），
> 是可复现的取证值，非估计。

---

## Completed Work

按 HANDOFF-001 的 WP-1 → WP-6 顺序完整实施（同一 PR 内闭环，未拆后续任务）：

- **阶段 0 取证**：gh api 实测 PR #20/#21（1 / 3 提交、merged_at、merge sha）、CI + Docker run id
  与 conclusion、DockerHub Tags API 镜像 tag 与 digest；基线门禁全绿（test 27 文件 / 351 用例
  —— **该计数含 `shared/dist` 重复，真实 331；R-2 已更正为 26 文件 / 325 用例**，见本文件 Tests 字段注）。
- **WP-1**：TASK-045 / TASK-046 Merge Record 九要素实测回填 + `Status → DONE` + `git mv` 至 `done/`；
  过时指针与占位值清零（grep 全库零命中）。
- **WP-2**：模板 `## Merge Record` 章节（位置 = Handoff 之后、Task Rules 之前）；
  `scripts/audit-repo.py` 新增 F8 / F9；**两条门禁均做了「故意造缺陷 → FAIL → 复原 → PASS」
  的反向验证并留真实输出**（AC-6 用 TASK-026 档案改标题；AC-7 用临时合成目录与 TASK-041 撞号，
  已即时删除并复原，两次复跑均回到 PASS=9 FAIL=0）；HD-1 白名单与裁决日期落进脚本注释、
  Known Issues 与 `known-pitfalls.md` §14。
- **WP-3**：两值口径 6 处改写（overview 175/180-182/401/567 + api-contract 150）；
  `projects/README.md` 快照三处修正（done=46 / review=1 / backlog=0，实测日标注）；Docker 口径精确化。
- **WP-4**：docker.yml checkout v5（AC-12 判据全 v5）；dependabot github-actions weekly；
  knip 以白名单接入 CI（`pnpm knip` 实跑退出码 0）；audit_framework.py 纳入 CI
  （PyYAML runtime 安装，依据 KI-4 的取舍，A3 不再 SKIP）。
- **WP-5**：`effectiveTrafficTotal` 删除 + re-export + 两处测试同步（备份 `/tmp/t047-wp5`）；
  两被报依赖**保留**（shadcn 托管组件引用，删依赖破坏类型链）并落白名单理由（KI-9 / AC-17）；
  `.tmp-t043` / `.tmp-t046` 已按 HD-3 转存后删除（KI-8，`ls` 零残留）。
- **WP-6**：`handoffs/2026-10-21-posthoc-recheck.md`（首行含 TASK-047 且作者为执行位；明示事后复核非合并前审查）。
  **F-8 已修**：原名 `2026-10-21-coordinator-recheck.md`，因该文件名按 `.agents/protocols/handoff.md`
  §3.2 属**主控位专用**而派给了执行位，属主控位设计缺陷；已更名并更正首行作者。

**AC-20 全门禁复跑结果（合并前最后一树）：** 见本文件 Tests 字段与本任务档案清单；全部绿。

---

## Tests

```yaml
命令与结果（2026-10-21，分支 chore/TASK-047-residual-debt-consolidation）:
  python scripts/audit-repo.py                  PASS=9 FAIL=0   # F8/F9 新增后
  python shared/scripts/audit_framework.py      PASS=13 FAIL=0 SKIP=0
  pnpm knip                                     退出码 0（白名单后积压清零）
  pnpm build:shared && pnpm lint && pnpm format:check   退出码 0
  pnpm test                                     27 文件 / 351 用例全绿，退出码 0
  pnpm build                                    退出码 0（先 mv dist /tmp，绕 safe-delete 假失败）
反向验证（AC-6 / AC-7）:
  造缺陷 → FAIL（F8 指出 TASK-026 缺章节；F9 列出合成目录与 TASK-041 冲突）→ 复原 → PASS
退出码说明: 本沙箱 pnpm 偶发 wmic 拦截使退出码失真，全部以「退出码 + 输出末尾用例数」双判
```

> ⚠️ **「27 文件 / 351 用例」为失真计数，2026-10-21 由主控位复审（F-2）实测推翻，
> 执行位已于 R-2 确认并更正。** 上方为原始自述，保留可追溯，**不作为事实采信**。
>
> 失真根因：`vite.config.ts` 的 `test` 未声明 `exclude`，而 Vitest 4 的**运行时**默认
> `exclude` 只有 `['**/node_modules/**', '**/.git/**']`（实测
> `node_modules/vitest/dist/chunks/defaults.*.js`；其类型声明 JSDoc 写着含 `**/dist/**`
> 的长列表，与运行时不符）。`shared/tsconfig.json` 未排除 `*.test.ts` ⇒ 测试被编译进
> `shared/dist/` ⇒ vitest 连编译产物里的测试一并收集，同一组用例执行两遍。
>
> **实测分解（R-2，执行位复跑）：**
>
> | 时点 | `Test Files` | `Tests` | 其中 `shared/dist` 重复 | 真实用例 |
> |------|--------------|---------|--------------------------|----------|
> | `main` 基线（TASK-047 开工前） | 27 | 351 | 20（`traffic.test.js` 当时为 20 例） | **331** |
> | WP-5 后、修正前（= 主控位实测 342） | 27 | 342 | 17 | **325** |
> | **R-2 修正后（当前）** | **26** | **325** | **0** | **325** |
>
> 故「351 − 6 = 345 ≠ 342」的完整解释：WP-5 从**源文件**删 6 例，
> 但 `dist` 副本随源码重建也少 3 例 ⇒ 总数降 **9**（6 + 3）而非 6。
> **修正后的稳定计数 = 26 文件 / 325 用例 / 失败 0**，不再随 `shared/dist` 新鲜度漂移。
> 处置：`vite.config.ts` 的 `test.exclude` 显式恢复 `**/dist/**`
> （`exclude` 整体替换默认值，故同时显式保留 `**/node_modules/**` 与 `**/.git/**`）。
> 详细命令与输出见 `HANDOFF-004-implementer-to-coordinator.md`。

---

## Changed Files

见本任务档案 `## Changed Files`（20 文件 + 工作区 README + 工作区级 .tmp 删除）。
本 PR 同时包含**一笔非执行位所为的档案修改吸收提交**（`e4d154c` —— 时间戳证明产生于
执行位提交之后；内容 = HANDOFF-003 完成标记补注 + TASK-045 末行换行，已单独提交披露）。

---

## Known Issues

- 档案 `Known Issues` KI-1 ~ KI-9 已更新：KI-8 = HD-3 转存内容（TASK-043/046 取证结论）；
  KI-9 = AC-16/17 处置理由。
- **C3 失真相状的发现**：实测 `dependabot.yml` 早已含 `github-actions`（monthly）与 `docker` 生态，
  与任务设计时点描述不符 —— 未按失真执行，据实改为「已存在 → 提频 weekly」并已披露。
- **AC-3 的既定例外未触发**：原计划容忍 HANDOFF-003 历史行残留，主控位会话以完成标记处理后
  grep 全库零命中（该非执行位修改已单独披露）。
- `.tmp-*` 的目录级备份在 `Temp\opencode\_t04{3,6}-archived-20261021`（易失区）——
  受管理落档在 KI-8，将来失联不构成证据损失。

---

## Remaining Work

- 主控位读实际 diff 审查（含 F8/F9 反向验证输出的复核）；
- 人类显式授权后由主控位 rebase-merge；执行位按 D13-C 保持 REVIEW 状态及其 Merge Record
  由下一个任务回填（KI-1）。

---

## Assumptions

- SSH 推送不受 `workflow` scope 限制（HD-2），实测本分支推送（若推送被拒按 HD-2 停工上报）。

---

## Risks

| 风险 | 缓解 |
|------|------|
| knip 白名单太大导致门禁迟钝 | 白名单逐条理由 + 新积压仍红；定期清理由后续任务承接 |
| audit_framework CI 步骤网络依赖（pip install） | pyyaml 为小轮子；**失败模式 = 安装失败时该步骤直接红、可重现，不会退化成「静默 SKIP」**（这正是 B5 要消灭的形态）。**R-1 已在 CI 证实**：`ubuntu-latest` 上 `python3 -m pip install pyyaml` **未被 PEP 668（externally-managed）拦截**，步骤 success，无需 `--break-system-packages` 或 venv 方案 |
| touch 到 shadcn 托管组件 | 未触碰（零改动 `src/components/ui/**`） |
| vitest 收集范围（R-2 新增） | `test.exclude` 显式含 `**/dist/**`；计数不再随 `shared/dist` 新鲜度漂移，见 KI-10 |

---

## Next Action

主控位：读实际 diff → 复审 AC-1~AC-21 → 判定 PASS / CHANGES_REQUESTED；
人类授权后执行 rebase-merge 并回填 PR 号至本档案 Merge Record（由下一任务承接，D13-C）。
