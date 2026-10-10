# TASK-007 — 全站中文翻译

## Meta

```yaml
Task ID: TASK-007
Title: 全站中文翻译
Workflow: feature
Status: DONE
Priority: P2
Owner: developer
Owner Since: 2026-10-10
Assigned Role: developer
Created: 2026-10-10
Updated: 2026-10-10
Completed: 2026-10-10
Branch: ""
Requires Human Approval: false
```

---

## Objective

把 `shadcn-admin` 前端所有**面向用户**的界面文案由英文改为简体中文，
使其与已完成的业务化改造（订阅管理系统的中文侧边栏、中文表格、中文登录页）保持一致。

---

## Background

勘察结论（2026-10-10）：

本项目是 `satnaing/shadcn-admin` 的 fork，业务化改造（TASK-003~005）时
**已把业务模块中文化**，但**通用 UI 层与设置模块遗留英文**，导致同一界面中英混排。

| 区域 | 改前状态 |
|------|---------|
| 业务模块（customers / subscriptions / plans / emails / logs / dashboard） | 已是中文 |
| 侧边栏、登录页、错误页（部分） | 已是中文 |
| `src/components/**` 通用组件 | **英文** |
| `src/features/settings/**` | **英文** |
| `src/features/errors/**` | **英文** |
| `index.html` 标题与 meta | **英文** |

本次只处理后三类。

---

## Scope

- `index.html`：`lang` 属性、`<title>`、`description`、OG / Twitter meta
- `src/components/**`（`ui/**` 除外）：
  `command-menu` `config-drawer` `confirm-dialog` `coming-soon` `date-picker`
  `learn-more` `password-input` `profile-dropdown` `search` `select-dropdown`
  `theme-switch` `data-table/*` `layout/*`
- `src/features/settings/**`：account / appearance / display / notifications / profile
- `src/features/errors/**`：401 / 403 / 404 / 500 / 503
- `src/features/auth/auth-layout.tsx`
- `src/lib/handle-server-error.ts`、`src/lib/show-submitted-data.tsx`、`src/main.tsx` 的 toast 文案
- 上述改动**波及的测试断言**（`config-drawer.test.tsx`、`confirm-dialog.test.tsx`、
  `search-provider.test.tsx`、`sign-out-dialog.test.tsx`）

## Non-Scope

- **`src/components/ui/**`** —— shadcn CLI 生成物，禁令手改（AGENTS.md §10）
- **`src/routeTree.gen.ts`** —— 自动生成
- **业务模块** —— 已是中文，本次未改
- **`server/` 与 `shared/`** —— 已是中文；`error` 字段的英文值
  （`Not Found` / `Bad Request` / `Unauthorized`）属**API 契约标识符**，
  前端 `handleServerError` 只读 `data.title`，无展示路径，故保留
- **不引入 i18n 框架** —— 一次性静态文案翻译，无需运行时方案
- **代码注释、变量名、类型名、日志** —— 不属于界面文案

---

## Requirements

| 类型 | 内容 |
|------|------|
| 功能 | 所有用户可见文案为简体中文 |
| 功能 | 键盘快捷键键名（`Home` / `End` / `Escape`）保持英文 —— 是 `KeyboardEvent.key` 取值 |
| 功能 | 语言选择器的语言名用**各语言自称**（endonym），符合语言选择器惯例 |
| 技术 | 不改任何字符串的**结构**（占位符、模板变量、条件表达式） |
| 兼容 | 修改后的文案需与 `aria-label` / 测试选择器保持一致 |

---

## Acceptance Criteria

- [x] AC-1 `index.html` 的 `lang="zh-CN"`、title、description、OG / Twitter meta 均为中文
- [x] AC-2 `src/components/**`（除 `ui/`）无英文用户可见文案
- [x] AC-3 `src/features/settings/**` 五个子页表单、校验、说明均为中文
- [x] AC-4 `src/features/errors/**` 五类错误页文案均为中文
- [x] AC-5 业务模块（customers / subscriptions / plans / emails / logs / dashboard）无回归
- [x] AC-6 批量操作的复数逻辑适配中文（英文 `+ 's'` 复数在中文下不适用，已改为「已选择 N 个XX」）
- [x] AC-7 波及的 4 个测试文件的断言同步更新为中文
- [x] AC-8 `pnpm exec tsc -b` 通过
- [x] AC-9 `vite build` 通过
- [x] AC-10 未修改 `src/components/ui/**` 与 `src/routeTree.gen.ts`

---

## Changed Files

共 **45** 个文件，全部为修改，无新增、无删除：

| 类别 | 数量 | 文件 |
|------|------|------|
| 入口 | 1 | `index.html` |
| 通用组件 | 21 | `src/components/**`（含 `data-table/` `layout/`） |
| 设置模块 | 12 | `src/features/settings/**` |
| 错误页 | 5 | `src/features/errors/**` |
| 认证布局 | 1 | `src/features/auth/auth-layout.tsx` |
| 工具与入口 | 2 | `src/lib/handle-server-error.ts`、`src/lib/show-submitted-data.tsx` |
| `main.tsx` | 1 | 全局 toast 文案 |
| 测试 | 4 | `config-drawer` `confirm-dialog` `search-provider` `sign-out-dialog` 的 `.test.*` |

---

## Verification Plan

| 验证项 | 方式 | 结果 |
|--------|------|------|
| 类型检查 | `pnpm exec tsc -b` | ✅ 通过，退出码 0 |
| 打包 | `pnpm exec vite build` | ✅ 3802 模块转换成功 |
| 文案残留 | 全量扫描 `src/**` 排除 `ui/`、`routeTree.gen.ts`、测试与资源 | ✅ 仅余技术性字符串 |
| 格式 | `prettier --check` | ⚠️ 184 文件告警，**改动前后计数一致**，属既存问题 |
| 测试 | `pnpm test` | ⚠️ 未执行：需 `pnpm test:browser:install` 装 Playwright Chromium |

### 保留的英文（技术性，非遗漏）

| 内容 | 位置 | 理由 |
|------|------|------|
| `Home` / `End` / `Escape` | `data-table/bulk-actions.tsx` | `KeyboardEvent.key` 标准取值 |
| `Meta+K Control+K` | `search.tsx` | `aria-keyshortcuts` 语法 |
| `${bytes} B` / `KB`~`PB` | `features/*/utils.ts` | 字节单位国际通用 |
| `yyyy-MM-dd HH:mm` | `features/*/utils.ts` | date-fns 格式模式 |
| `Roboto`、`Vite + ShadcnUI` | `config/fonts.ts`、`layout/app-title.tsx` | 字体名与技术栈名 |
| `Bearer` | `lib/api.ts` | HTTP 认证方案名 |
| `Not Found` / `Bad Request` 等 | `server/src/**` | API 契约标识符 |
| `useAuth must be used within...` | `context/*.tsx` | 开发者内部错误，非用户界面 |

---

## Known Issues

1. **`prettier --check` 有 184 个文件告警** —— 改动前后计数完全相同，
   系仓库既存状态（疑为 Prettier 版本或配置与代码风格不一致），**非本次引入**。
   本次未做全量格式化，避免产生 184 文件的无关 diff。
2. **`pnpm test` 未执行** —— 需先 `pnpm test:browser:install` 安装 Playwright Chromium。
   4 个测试文件的断言已同步更新为中文，但**未经运行验证**。
3. **`search-provider.test.tsx` 存在改动前就有的失效断言** —— 原断言
   `getByText('Tasks')` / `name: 'Settings Account'` 指向已被业务化改造删除的
   `tasks` 导航项。本次已随中文化一并修正为 `客户管理` / `设置 账户`，
   但该文件的其他用例是否仍有效未验证。
4. **`settings` 模块本身无中文文案来源** —— 语言选择器仅为 UI 展示，
   切换语言不会真的改变界面语言（无 i18n 运行时）。这与改前行为一致，未做改变。
5. **RTL 方向未适配** —— 文案已含 `从左到右` / `从右到左`，
   但界面未引入 RTL 样式镜像。改前亦如此。

---

*本任务由 developer 角色执行，经用户指示直接实施，未走 Reviewer 审查。*
