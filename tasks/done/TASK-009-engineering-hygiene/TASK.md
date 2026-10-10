# TASK-009 — 工程卫生：格式化 / lint / 行尾统一 / 测试同步

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-009
Title: 工程卫生：格式化 / lint / 行尾统一 / 测试同步
Workflow: chore
Status: DONE
Priority: P1
Owner: workbuddy
Owner Since: 2026-10-10
Assigned Role: developer
Created: 2026-10-10
Updated: 2026-10-10
Completed: 2026-10-10
Branch: ""
Requires Human Approval: false
```

> **登记说明（诚实记录）：** 本 Task 为**补登**。工作成果（4 个提交）在登记前
> 已完成并写入 Git 历史（均带 `Refs: TASK-009`），本次补齐登记文件。所有
> Verification Plan 中的验证均在补登时真实执行，非事后补写。

---

## Objective

清理 TASK-007 遗留的工程卫生问题，让 `lint` / `format:check` / `test`
三条质量门禁从「未知 / 红灯」转为全绿，并根治本机与 CI 的行尾幽灵差异：

1. 消除 prettier 全量格式告警（约 90 个文件），并区分「CRLF 检出假象」
   与「真实格式问题」
2. 修复 `pnpm lint` 的 25 个报错（CI lint 步骤此前因 install 失败从未执行，
   状态实为「未知」而非「通过」），含 1 个真实 React Hooks 缺陷
3. 新增 `.gitattributes` 统一 LF 行尾，根治「本机 format:check 红、CI 绿」
   的幽灵差异
4. 同步 TASK-007 中文化 / 重构后失配的测试断言，`pnpm test` 由
   9 失败 / 65 通过转为 74 / 74 全绿

---

## Background

**TASK-007（全站中文翻译）Known Issues 遗留：**

1. prettier 184 文件告警未处理（其中约 114 个为 `core.autocrlf=true`
   导致的 CRLF 检出假象，约 53 个为真实格式问题——真实问题意味着
   CI 的 format:check 同样会红）
2. `pnpm lint` 25 个错误：CI lint 步骤自 TASK-005 起因 install 失败
   从未真正执行过，本地此前也未跑过，状态是「未知」
3. 前端浏览器测试未运行（需 Playwright Chromium）；TASK-007 称 4 个
   测试文件断言已同步为中文，但未经运行验证
4. search-provider 失效断言（本轮完整测试枚举中未复现，疑似此前已被
   部分修复或为偶发，见 Known Issues）

**行尾问题根因：** Windows 本机 `core.autocrlf=true` 使工作区检出为
CRLF，而仓库内容与 prettier 配置（`endOfLine: lf`）均为 LF，导致本机
`format:check` 假红。根治手段是 `.gitattributes` 声明 `* text=auto eol=lf`。

---

## Scope

- prettier 全量格式化（仅格式，无逻辑改动）
- `eslint.config.js`：ignores 补 `server/dist` / `shared/dist` / `coverage`；
  新增后端 Node CLI 上下文覆盖块（放行 `no-console`，scripts 再放行
  `no-explicit-any`）
- `server/src/index.ts`：删除重复的副作用导入 `import './env.js'`
- `server/scripts/smoke.ts`：`let json: any = null` → `let json: any`
- `src/features/subscriptions/components/subscriptions-action-dialog.tsx`：
  将到期时间选择器开合状态 `useState` 从 `FormField` render 回调内
  提升到组件顶层（真实缺陷修复）
- `.gitattributes`：`* text=auto eol=lf` + 二进制例外
- `docs/operations/known-pitfalls.md`：CRLF 条目更新为已修复状态
- 三个测试文件的断言同步（见 Changed Files）

## Non-Scope

- 不引入 i18n 框架
- 不改任何业务逻辑与 UI 行为（除上述 Hook 位置修正外）
- 不为 `AuthProvider.logout` 补集成测试（见 Known Issues）
- 不修改 `src/components/ui/**`、`src/routeTree.gen.ts`
- 不跟进上游 `satnaing/shadcn-admin` 更新

---

## Requirements

| 类型 | 内容 |
|------|------|
| 质量 | `pnpm lint` 0 错误；`pnpm format:check` 全绿；`pnpm test` 全绿 |
| 质量 | 格式化不得引入任何逻辑 diff（f0c621a 为纯格式提交） |
| 正确 | `useState` 不得出现在 `FormField` render 回调内（react-hooks/rules-of-hooks） |
| 兼容 | `.gitattributes` 不得破坏既有二进制资产（png/jpg/ico/woff 声明 binary） |
| 兼容 | eslint 覆盖块不得放行前端源码的 `no-console` |

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | prettier `endOfLine: lf` 与 `.gitattributes` 必须一致 |
| 技术 | Hook 提升不得改变组件行为（该对话框为单一实例，提升无副作用） |
| 环境 | 本机 `core.autocrlf=true` 短期保留（全局配置不动），行尾一致性由 `.gitattributes` 保证 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-007（全站中文翻译） | 遗留问题来源 | 已完成 |
| TASK-008（邮箱重构 + CI 配置） | 前置（CI install 修复后 lint 步骤才可执行） | 已完成 |

---

## Acceptance Criteria

- [x] AC-1 `pnpm format:check` 通过，无格式告警
- [x] AC-2 `pnpm lint` 0 错误 0 警告
- [x] AC-3 `pnpm test` 74 / 74 通过（10 个测试文件）
- [x] AC-4 `pnpm exec tsc -b` 与 `pnpm typecheck:server` 均通过
- [x] AC-5 `pnpm exec vite build` 通过（3802 模块）
- [x] AC-6 `.gitattributes` 存在且声明 `* text=auto eol=lf`
- [x] AC-7 真实 Hook 缺陷已修复并经 lint 验证
- [x] AC-8 `known-pitfalls.md` CRLF 条目反映已修复状态

---

## File Scope

```yaml
File Scope:
  - eslint.config.js
  - .gitattributes
  - server/src/index.ts
  - server/scripts/smoke.ts
  - src/features/subscriptions/components/subscriptions-action-dialog.tsx
  - src/lib/handle-server-error.test.ts
  - src/components/sign-out-dialog.test.tsx
  - src/components/password-input.test.tsx
  - docs/operations/known-pitfalls.md
  - tasks/done/TASK-009-engineering-hygiene/**
Non-Scope (files):
  - src/components/ui/**
  - src/routeTree.gen.ts
  - server/src/**
```

---

## Implementation Plan

1. 运行 `pnpm test:browser:install` 安装 Playwright Chromium headless shell
2. 完整枚举 `pnpm test` 失败（verbose reporter，避免输出截断）
3. 分类修复：断言中文化同步（2 文件）/ auth context mock 重写（1 文件）
4. prettier 全量格式化 → `.gitattributes` 根治行尾
5. 修复 lint 25 错误（真实 Hook 缺陷 + eslint 配置覆盖 + 两处小修）
6. 全量验证 → 4 个原子提交 → 补登本文件

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 | 结果 |
|--------|------|------------|------|
| AC-3 | 命令 | `pnpm test`（vitest browser headless） | ✅ 74 通过 / 0 失败（10 文件） |
| AC-2 | 命令 | `pnpm lint` | ✅ 0 错误 |
| AC-1 | 命令 | `pnpm format:check` | ✅ 全部合规 |
| AC-4 | 命令 | `pnpm exec tsc -b` && `pnpm typecheck:server` | ✅ 均退出码 0 |
| AC-5 | 命令 | `pnpm exec tsc -b && pnpm exec vite build --emptyOutDir false` | ✅ 1.45s，3802 模块 |
| AC-7 | lint 规则 | react-hooks/rules-of-hooks 对该文件 0 报错 | ✅ |
| 测试修复充分性 | 人工 | 修复后失败集合为空（非跳过、非弱化断言） | ✅ |

**说明：**

- `vite build` 需附加 `--emptyOutDir false`：本机沙箱的 safe-delete 策略
  拦截 vite 对 `dist/assets`（累计 90 个旧产物）的批量清空，
  `SAFE_DELETE_BULK_CONFIRM_REQUIRED`。打包与转换本身成功（3802 模块），
  该限制为环境行为而非代码问题。
- server 冒烟测试（31 项）在 TASK-008 已验证通过；本任务未触碰
  server 业务代码，冒烟结果依然有效。

---

## Current State

DONE。工作区干净，全部改动已提交（4 个提交，`Refs: TASK-009`）。
`pnpm test` 由 9 失败 / 65 通过 转为 74 / 74 全绿。

---

## Changed Files

共 **61** 个文件（378 insertions / 332 deletions），分布于 4 个提交：

| 提交 | 内容 | 文件数 |
|------|------|--------|
| `f0c621a` style: 全量执行 prettier 格式化 | 52 个文件（+245 / -241），纯格式无逻辑改动 | 52 |
| `28dfba4` fix: 修复 eslint 报错 | `eslint.config.js`、`server/src/index.ts`、`server/scripts/smoke.ts`、`src/features/subscriptions/components/subscriptions-action-dialog.tsx` | 4 |
| `7de3481` chore: .gitattributes | `.gitattributes`（新增）、`docs/operations/known-pitfalls.md` | 2 |
| `4a700fb` test: 同步测试断言 | `src/lib/handle-server-error.test.ts`、`src/components/sign-out-dialog.test.tsx`、`src/components/password-input.test.tsx` | 3 |

---

## Known Issues

1. **CI 实际运行结果未知** —— 本环境无法执行 GitHub Actions。四条门禁
   （lint / format:check / test / build）已在本地全绿，但 CI 转绿需推送后
   观察运行记录。
2. **`AuthProvider.logout` 无直接测试覆盖** —— sign-out-dialog 测试
   mock 掉了 auth context，只验证组件契约（确认 → logout()）。
   `logout` 内部的 `api.logout() → clearSession → navigate` 序列
   依赖 QueryClient / Router / api 网络层，装配成本高，未补集成测试。
   注：主动退出不带 redirect 回跳是自洽设计（redirect 机制由
   `main.tsx` 过期处理与 `_authenticated` 路由守卫消费）。
3. **TASK-007 提到的「search-provider 失效断言」本轮未复现** ——
   完整枚举的 9 个失败中不含 search-provider；该文件 8 个用例本轮
   全部通过。疑为此前已被部分修复或偶发失败，留待 CI 复跑确认。
4. **沙箱对 `dist` 清理的拦截** —— 本机 `pnpm build` 需
   `--emptyOutDir false`；全新环境（dist 为空）不受影响，CI 不受影响。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | developer | — | 2026-10-10 | 四条门禁本地全绿；遗留 CI 实跑观察 |

**最新 Handoff：** `handoffs/HANDOFF-001-developer-to-next.md`
**Next Action：** 推送 `main` 后观察 GitHub Actions `Continuous Integration`
是否转绿（install → lint → format:check → test → build）；随后更新
Workspace 登记表 `projects/README.md` 与项目文档中的过时状态描述。

---

## Task Rules

- [补充] 本任务为补登任务：验证必须先于登记，验证记录以本文件
  Verification Plan 为准。
- [补充] `.gitattributes` 已统一 LF 行尾；后续任何任务不得在仓库中
  引入 CRLF 内容，也不得为迁就本机 autocrlf 修改 prettier 的
  `endOfLine` 配置。

---

## Notes

- prettier 告警的根因拆分方法：先 `pnpm format` 后看 `git diff` 中
  真实格式改动（53 文件）与纯行尾改动（约 114 文件，交由
  `.gitattributes` 根治），避免把环境问题当代码问题修。
- `useState` 提升修复的诊断过程记录于提交 `28dfba4` 的 message；
  教训：render 回调内调用 Hook 在本机 dev 模式可能不报错，
  lint 与 React 严格模式才会暴露，质量门禁必须先于人工验证。
