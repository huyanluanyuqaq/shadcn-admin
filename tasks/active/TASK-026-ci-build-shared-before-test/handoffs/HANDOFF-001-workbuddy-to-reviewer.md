# HANDOFF-001-workbuddy-to-reviewer

```yaml
From: workbuddy (Developer + Tester)
To: Reviewer
Task: TASK-026-ci-build-shared-before-test
Date: 2026-10-13
```

## Current State

Status: REVIEW。修复已提交于分支 `fix/TASK-026-ci-build-shared-before-test`
（commit `cef4a8c`），待合并 main。

## Completed Work

1. 复现与定位（CI run 38277694007，commit 539d008）：
   - 失败步骤 `Run tests`；lint / format:check / 浏览器安装均通过。
   - 根因：TASK-025（79799ca）首次引入 `server/src/services/notification-format.test.ts`，
     根 vitest 默认扫描范围自此覆盖 `server/`；该测试链路导入 `@repo/shared`，
     exports 指向 `shared/dist`，CI 从未构建 → Vite 依赖扫描失败
     （`Failed to resolve import "@repo/shared"`）→ 跳过预打包 →
     浏览器测试 React 多副本 → `Invalid hook call` 批量失败
     （confirm-dialog 9/9、config-drawer 15/15、search-provider 7/8 等）。
   - 本地不复现原因：本机 shared/dist 已存在。
2. 修复：`.github/workflows/ci.yml` 在 Install dependencies 后新增
   `Build shared package`（`pnpm build:shared`）步骤，附根因注释。
3. 验证：
   - 定向：移走 shared/dist → build:shared → 两个受影响测试文件 27/27。
   - 全量：`pnpm test` 19 files / 232 tests 全过，exit 0。

## Changed Files

- `.github/workflows/ci.yml`（+7 行：1 个 step + 4 行注释）
- `tasks/active/TASK-026-ci-build-shared-before-test/TASK.md`

## Tests

- `pnpm test`：19 passed (19) / 232 passed (232)，exit 0。
- `npx prettier --check .github/workflows/ci.yml`：通过。

## Known Issues

- 沙箱内首次全量跑 exit 1：safe-delete 守卫拦截 Vite 优化器临时目录
  （`node_modules/.vite/vitest/.../deps_temp_*`，78 文件 > 50 阈值）清理，
  触发未处理拒绝。缓存稳定后复跑 exit 0；CI 环境无此 shim。

## Remaining Work

- Reviewer 审查 → 合并 main → 观察 CI 38277694007 的后续运行转绿。

## Assumptions

- server 测试进入根 vitest 是 TASK-025 既定意图，不缩小 include 范围。
- CI 与本地约定对齐（先 build:shared）优于为测试单设 alias。

## Risks

- 低。改动仅增加一个 CI 步骤，不影响运行时与构建产物。
- docker.yml 的构建链是否已含 build:shared 未在本次核对（其近期运行均成功，
  推断无妨；如后续失败再单独立项）。

## Next Action

Reviewer 审查 `cef4a8c`；通过后合入 main 并确认 CI 转绿。
