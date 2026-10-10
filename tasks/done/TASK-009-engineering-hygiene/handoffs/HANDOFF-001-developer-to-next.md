# HANDOFF-001 — developer → next

- **日期：** 2026-10-10
- **提交范围：** `f0c621a`、`28dfba4`、`7de3481`、`4a700fb`（均 `Refs: TASK-009`）

## 验证结果（补登时真实执行）

| 门禁 | 命令 | 结果 |
|------|------|------|
| 测试 | `pnpm test` | 74 / 74 通过（10 文件；修复前 9 失败 / 65 通过） |
| lint | `pnpm lint` | 0 错误 |
| 格式 | `pnpm format:check` | 全部合规 |
| 类型 | `pnpm exec tsc -b` / `pnpm typecheck:server` | 均退出码 0 |
| 构建 | `pnpm exec vite build --emptyOutDir false` | 1.45s，3802 模块 |
| 冒烟 | `pnpm --filter server smoke` | TASK-008 已验 31/31；本任务未触碰 server 代码，结果仍有效 |

## 假设与决策

1. **sign-out-dialog 测试重写为组件契约验证**（mock `@/context/auth-context`）：
   旧测试断言的是已被 `9fefc87` 废弃的内联实现（auth.reset + redirect）。
   redirect 回跳机制经核实由 `main.tsx` 过期处理与 `_authenticated` 路由守卫
   消费，主动退出不带 redirect 是自洽设计，未改应用行为。
2. **vite build 加 `--emptyOutDir false`**：沙箱 safe-delete 策略拦截 vite
   清空 `dist/assets`（累计 90 个旧产物，单轮批量删除阈值 50）。打包本身
   成功，属环境限制。
3. **prettier 告警拆分处理**：约 114 个 CRLF 假象交由 `.gitattributes`
   根治，53 个真实格式问题由 `f0c621a` 修复——未把环境问题当代码问题修。

## 风险

- CI 五步（install → lint → format:check → test → build）本地全绿但
  **未经 GitHub Actions 实跑验证**；CI 的 Playwright 安装步骤
  （`playwright install chromium`）与本地版本差异可能导致 test 步行为不同。
- `AuthProvider.logout` 无直接测试覆盖（见 TASK-009 Known Issues #2）。

## Next Action

1. 推送 `main`（7 个提交待推送：TASK-008 三个 + TASK-009 四个）。
2. 观察 GitHub Actions `Continuous Integration` 是否转绿；若 test 步失败，
   优先怀疑 Playwright 浏览器版本差异。
3. 更新 Workspace 登记表 `projects/README.md`（shadcn-admin 状态仍为
   planning、任务仍写 backlog 5 个，与实际严重不符）及项目文档中的
   过时状态描述。
