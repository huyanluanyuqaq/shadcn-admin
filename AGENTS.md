# AGENTS.md — shadcn-admin

> 本项目级 Agent 入口协议。
> **两种工作模式：**
> - **Workspace 模式**（项目位于 Workspace 的 `projects/` 下）：本文件 + Workspace `AGENTS.md` + Task 规则共同生效。
> - **Standalone 模式**（项目被单独 clone，无 Workspace）：本文件 + Task 规则生效，见 §12。

---

## 1. Project Identity

```yaml
Project: shadcn-admin
Slug: shadcn-admin
Version: 2.2.1
Status: planning
Owner: huyanluanyuqaq
Repository: https://github.com/huyanluanyuqaq/shadcn-admin.git
Created: 2026-10-09
Upstream: satnaing/shadcn-admin（本仓库为其 fork，接入时尚无自定义提交）
```

**二次开发目标：** 以本仓库为**前端基座**，扩展出一套可通过 `docker compose` 自托管部署的
**用户订阅管理系统**，功能范围：订阅管理、客户管理、邮箱管理、仪表盘、通知、日志、套餐。

---

## 2. Project Purpose

一个以 shadcn/ui 组件体系构建的 Admin Dashboard 前端，现作为用户订阅管理系统的 UI 基座进行二次开发。

**目标用户：** 需要自托管、可离线运行的订阅业务运营者。

**核心价值：** 复用成熟的后台 UI 交互范式（数据表格、批量操作、对话框、命令面板、主题切换），
将开发投入集中在业务后端与领域模型上。

---

## 3. Technology Stack

| 类别 | 选型 |
|------|------|
| 语言 | TypeScript ~6.0 |
| 前端 | React 19.2 + Vite 8 |
| 路由 | TanStack Router 1.168（文件路由，`routeTree.gen.ts` 自动生成） |
| 样式 | Tailwind CSS 4.2（**注意：v4，非 3.x**） |
| UI 组件 | shadcn/ui（Radix UI 原语），30 个组件位于 `src/components/ui/` |
| 数据请求 | TanStack Query 5.99 + axios 1.15 |
| 表格 | TanStack Table 8.21 + `@tanstack/react-table` 封装（`src/components/data-table/`） |
| 图表 | Recharts 3.8 |
| 表单 | react-hook-form 7 + zod 4 |
| 状态 | zustand 5 |
| **后端** | **无（纯前端 SPA）—— 待建设，方案见 `docs/architecture/overview.md`** |
| **数据库** | **无 —— 待建设** |
| **认证** | Clerk（`@clerk/react` 6.4.3，SaaS 托管）—— **待替换为自建 JWT** |
| 测试 | Vitest 4 + `@vitest/browser-playwright`（浏览器模式）+ Testing Library |
| 包管理 | **pnpm**（`pnpm-lock.yaml`，**不要用 npm/yarn**） |
| 容器化 | **无（仅 `netlify.toml` 静态部署）—— 待建设 Dockerfile + docker-compose.yml** |
| CI/CD | GitHub Actions（`.github/`） |

**核心依赖：** 见 `package.json`。

---

## 4. Project Structure

> 本节记录项目的**实际**结构，不是模板结构。

```
shadcn-admin/
├── AGENTS.md              ← 本文件
├── README.md              ← 上游原文（未改动）
├── docs/                  ← 协调层（新增）
│   ├── requirements/  architecture/  technical/  decisions/  operations/
├── tasks/                 ← 协调层（新增）：backlog/ active/ review/ done/
├── src/
│   ├── assets/  components/  config/  context/  hooks/  lib/  stores/  styles/
│   ├── components/
│   │   ├── ui/             ← 30 个 shadcn 原语组件（勿手改，用 shadcn CLI 增删）
│   │   ├── data-table/     ← TanStack Table 封装：分页/列显隐/排序/faceted 筛选/批量操作
│   │   └── layout/ command-menu.tsx theme-switch.tsx ...
│   ├── features/           ← 按领域分包（二次开发的主要战场）
│   │   ├── apps/  chats/   ← 与订阅业务无关，可删除
│   │   ├── auth/           ← 登录/注册/OTP/忘记密码 UI
│   │   ├── dashboard/      ← 图表（Recharts）
│   │   ├── errors/  settings/（含 notifications 子页）
│   │   ├── tasks/          ← CRUD 完整范式（含 import-dialog）
│   │   └── users/          ← CRUD 完整范式（dialogs/columns/provider/table/bulk-actions）
│   ├── routes/             ← 文件路由
│   │   ├── (auth)/         ← sign-in / sign-up / otp / forgot-password
│   │   ├── clerk/          ← Clerk 专用路由（待移除）
│   │   └── _authenticated/ ← 需登录访问：users/ tasks/ apps/ chats/ settings/ help-center/
│   ├── routeTree.gen.ts    ← **自动生成，禁止手改**
│   └── test-utils/
├── netlify.toml           ← 静态部署配置（容器化后将被取代）
└── vite.config.ts
```

**关键目录说明：**

| 目录 | 用途 |
|------|------|
| `src/features/<domain>/` | 领域模块。每个模块含 `components/`、`data/`（`schema.ts` zod 校验 + `data.ts` mock）、`index.tsx` |
| `src/components/data-table/` | 通用表格能力，所有列表页复用 |
| `src/components/ui/` | shadcn 原语，**通过 CLI 管理，不手写修改** |
| `src/routes/` | TanStack Router 文件路由，新增页面后需重新生成 `routeTree.gen.ts` |

---

## 5. Development Commands

```bash
# 安装依赖（pnpm，非 npm）
pnpm install

# 本地运行（Vite dev server）
pnpm dev

# 类型检查 + 构建
pnpm build          # tsc -b && vite build

# 预览构建产物
pnpm preview

# Lint
pnpm lint

# 格式化
pnpm format         # 写入
pnpm format:check   # 仅检查

# 未使用导出检查
pnpm knip
```

**后端：**

```bash
# 安装（含 server 与 shared 两个 workspace 包）
pnpm install

# 开发
pnpm dev:server                    # tsx watch，默认 :3000
pnpm --filter server typecheck     # 类型检查

# 构建（shared 必须先于 server 构建，server 依赖其 dist 产物）
pnpm build:shared
pnpm build:server

# 数据库
pnpm db:generate      # 由 schema.ts 生成迁移 SQL 到 server/drizzle/
pnpm db:migrate       # 应用迁移到 data/app.db

# 端到端冒烟测试（需服务已启动）
pnpm --filter server smoke
```

**本地开发需同时起两个进程：**

```bash
pnpm dev:server       # 后端 Hono，:3000
pnpm dev              # 前端 Vite，:5173（已配置 /api 代理到 :3000）
```

前端通过 `vite.config.ts` 的 proxy 访问后端，因此 `VITE_API_BASE_URL` 保持默认 `/api` 即可。

**环境变量：**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `./data/app.db`（相对 server 工作目录） | SQLite 文件路径 |
| `PORT` | `3000` | 后端监听端口 |
| `VITE_API_BASE_URL` | `/api` | 前端 API 前缀 |

---

## 6. Testing Commands

```bash
# 首次需安装浏览器
pnpm test:browser:install     # playwright install chromium --with-deps

# 运行全部测试（浏览器模式，headless）
pnpm test

# 监听模式
pnpm test:watch

# 覆盖率
pnpm test:coverage
```

**测试要求：**
- 测试为 Vitest **浏览器模式**（`@vitest/browser-playwright`），非 jsdom —— 组件测试在真实 Chromium 中运行。
- 测试文件与源码同目录，命名 `*.test.tsx`（如 `features/users/components/users-dialogs.test.tsx`）。
- 新增业务模块时，至少为「对话框表单校验」与「表格行操作」补测试，参照 `features/users/` 现有测试。

---

## 7. Build Commands

```bash
# 构建前端产物（输出 dist/）
pnpm build

# 构建容器镜像（待 Dockerfile 落地后启用）
# docker build -t subscription-admin:latest .
```

---

## 8. Deployment Commands

```bash
# 当前：Netlify 静态部署（netlify.toml）
# 目标：Docker Compose 自托管（待建设）
# docker compose up -d --build
```

**部署约束：** 目标形态为**单容器 + SQLite 数据卷**的 `docker compose` 部署；
生产部署需人类批准（见 `.agents/protocols/change-safety.md`）。

---

## 9. Documentation Locations

| 文档类型 | 位置 |
|----------|------|
| 需求文档 | `docs/requirements/` |
| **架构文档（后端与容器化方案）** | `docs/architecture/overview.md` |
| 技术文档 | `docs/technical/` |
| 架构决策记录 | `docs/decisions/` |
| 运维文档 | `docs/operations/`（含 `agent-constraints.md`） |
| 任务 | `tasks/` |

**写文档前请先读：** `.agents/rules/documentation.md`（Workspace 模式）或本文件 §12（Standalone 模式）。

---

## 10. Project-specific Rules

- [补充] **Adoption 铁律**：本项目为「就地接入」的既有仓库。协调层（`AGENTS.md`/`docs/`/`tasks/`）为新增；
  在架构方案获得人类确认前，**不得改动代码层**（`src/`、`package.json`、`vite.config.ts` 等）。
- [补充] 包管理器固定为 **pnpm**；新增依赖一律 `pnpm add`，不得生成 `package-lock.json` 或 `yarn.lock`。
- [补充] `src/routeTree.gen.ts` 与 `src/components/ui/` 为生成/托管文件，禁止手工编辑。
- [补充] mock 数据当前来自 `@faker-js/faker`（`features/*/data/data.ts`）。接后端后，
  **必须改为 TanStack Query 调用真实 API**，并删除对应 faker 数据与 devDependency。
- [增强] 涉及认证（Clerk → JWT 迁移）、密钥、数据库迁移的变更，必须经 **Security 角色**审查后方可合入。

---

## 11. Rule Composition（规则组合）

```
Workspace 规则（通用默认）
        │ 可被本项目覆盖（非受保护部分）
        ▼
Project 规则（本文件 §10）
        │ 可被 Task 覆盖
        ▼
Task 规则（TASK.md 的 Task Rules 节）
        │
        ▼
受保护规则始终生效，不可被以上任何一层削弱
```

---

## 12. Standalone Mode（独立运行）

本项目被单独 `git clone` 后，**没有 Workspace**。此时：

**仍然有效：** 本文件（项目规则）、`tasks/` 中的 Task 与 Handoff、`docs/` 中的全部文档。

**缺失：** `.agents/roles/`、`.agents/workflows/`、`.agents/rules/`、`.agents/protocols/`。

**应对方式：**
1. 核心约束已内嵌于 `docs/operations/agent-constraints.md`，Standalone 下同样必须遵守。
2. 需完整规范时，重新 clone 原 Workspace 并把本项目放回 `projects/` 下。

**Standalone 下的最小工作流：**

```
读本文件 → 读 TASK.md → 按 §3 技术栈与 §5-§8 命令工作
        → 遵守 §10 项目规则 + §12 内嵌约束
        → 写 Handoff 到 task 的 handoffs/
```

---

## 13. Project Agent Notes

> 项目特有的易错点。

1. **Tailwind 版本隔离（重要）**：本项目为 **Tailwind CSS 4.2 + Vite 8**；
   同 Workspace 下的 `projects/business-manager` 为 **Tailwind 3.4**。
   **两边组件不可互相复制粘贴** —— Tailwind 4 使用 CSS-first 配置与 `@theme`，
   且 shadcn 组件结构在两个大版本间不兼容。跨项目借鉴只能参考交互模式，必须重写实现。
2. **纯前端，无持久层**：当前所有数据为 faker mock，刷新即变。任何"功能已完成"的断言，
   在接入真实 API 前都只代表 UI 存在，不代表数据可用。
3. **Clerk 与自托管目标冲突**：Clerk 是 SaaS 认证，依赖外网与 `VITE_CLERK_PUBLISHABLE_KEY`。
   目标是 `docker compose` 自托管，因此**必须移除 Clerk**，改为自建 JWT。
   注意 `src/routes/clerk/` 与 `features/auth/` 存在两套认证路由，迁移时需一并处理。
4. **测试方法特殊**：Vitest 浏览器模式需 Playwright Chromium。沙箱/CI 环境下若未执行
   `pnpm test:browser:install`，测试全部失败 —— 这不是代码缺陷。
5. **上游同步**：本仓库是 `satnaing/shadcn-admin` 的 fork。若需跟进上游更新，
   应通过 upstream remote 合并，不要直接从上游网页复制文件（会破坏 Git 历史）。
6. **better-sqlite3 是原生模块，正常安装即可，但有两个前提**：
   它依赖预编译二进制（由 `prebuild-install` 从 GitHub Releases 拉取），
   取不到时才回退 `node-gyp` 源码编译（需 MSVC 工具链，本机没有，必然失败）。
   因此必须同时满足：
   1. **版本限定在 `^12.4.1`** —— **v13 起官方不再发布预编译资源**，装 v13 必然走到源码编译并失败；
   2. **允许 pnpm 执行构建脚本** —— pnpm 默认阻止依赖的 build scripts。
      本项目在根 `pnpm-workspace.yaml` 声明 `allowBuilds: { better-sqlite3: true, esbuild: true }`，
      直接 `pnpm install` 即可；若改用其他包管理器，需自行放行这两个包的 install 脚本。

   > ⚠️ **配置位置已变更（2026-10-10 修正）**：原写法是在根 `package.json` 里放
   > `"pnpm": { "onlyBuiltDependencies": [...] }`，**较新版本 pnpm 不再读取该字段**
   > （CI 原文：`The "pnpm" field in package.json is no longer read by pnpm`；
   > 实测本地 pnpm 10.29.3 仍读取，故本地不复现、只在 CI 暴露），
   > 且 `onlyBuiltDependencies` 列表语法**自 pnpm 11 起被移除**，由 `allowBuilds`
   > 映射（v10.26.0 引入，10.29.3 与 12 均支持）取代。
   > 配置放错位置会让 `pnpm install` 直接以 `ERR_PNPM_IGNORED_BUILDS` 中断，
   > 且 better-sqlite3 / esbuild 的构建脚本不执行。**新配置必须写在 `pnpm-workspace.yaml`。**

   **不要使用 `pnpm install --ignore-scripts`**（会跳过预编译下载，导致运行时报
   `Could not locate the bindings file`）。若已误装，执行 `pnpm rebuild better-sqlite3` 或
   删除 `node_modules/.pnpm/better-sqlite3@*` 后重装。

   **仅在极端情况下才手工放置二进制**：从
   `https://github.com/WiseLibs/better-sqlite3/releases/download/v<ver>/better-sqlite3-v<ver>-node-v<ABI>-win32-x64.tar.gz`
   下载（`<ABI>` 取 `node -p "process.versions.modules"`），解压 `better_sqlite3.node` 到
   `node_modules/.pnpm/better-sqlite3@<ver>/node_modules/better-sqlite3/build/Release/`。
   实测（2026-10-09，Node 22.22.2 / ABI 127 / win32-x64）：`pnpm install` 可自动完成，无需此步骤。
7. **shared 是编译产物消费**：后端以包 `@repo/shared` 引入其 `dist/`，
   因此**改动 shared 后必须先 `pnpm build:shared`**，否则后端 typecheck 用的是旧产物。
   前端则通过 Vite alias `@shared` 直接引入源码，无需构建。

---

*本文件是项目级 Agent 入口。修改前请确认不削弱受保护规则。*
