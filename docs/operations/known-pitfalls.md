# 已知坑点与规避方式

> 维护者：Architect · 更新：2026-10-13
> 本文记录本项目**实际踩过**的坑，以及已经落到代码/配置里的规避方式。
> 新增坑点请追加条目，不要删除历史条目（删除会让后来者重复踩坑）。

---

## 1. better-sqlite3 是原生模块，版本与构建脚本是硬约束

**现象：** `pnpm install` 在 `node-gyp` / `VisualStudioFinder` 处失败，
报 `gyp ERR! not ok`；或运行时报 `Could not locate the bindings file`。

**根因（三个，曾同时存在）：**

1. **v13 起官方不再发布预编译二进制**（GitHub Releases 无 assets），
   取不到预编译包时会回退源码编译，需要 MSVC 工具链；Windows 开发机通常没有，必然失败。
2. **pnpm 默认阻止依赖的 build scripts**（白名单为空），
   导致 `prebuild-install` 根本没机会运行。
3. 使用 `pnpm install --ignore-scripts` 会跳过预编译下载。

**已落地的规避：**

- `server/package.json` 锁定 `better-sqlite3: ^12.4.1`（解析到 12.11.1）
- 根 `pnpm-workspace.yaml` 声明（**注意不是 package.json**）
  `allowBuilds: { better-sqlite3: true, esbuild: true }`
- **禁止**使用 `pnpm install --ignore-scripts`；误用后执行 `pnpm rebuild better-sqlite3`
- 详见 `AGENTS.md` §13.6

> ⚠️ **2026-10-10 修正（曾导致 CI 长期红灯）：**
> 上述白名单原先写在根 `package.json` 的 `"pnpm": { "onlyBuiltDependencies": [...] }`。
> **较新版本 pnpm 不再读取该字段**（本地 pnpm 10.29.3 仍读取，故本地不复现），
> 且 `onlyBuiltDependencies` 列表语法自 pnpm 11 起被移除、由 `allowBuilds` 映射取代，
> 于是 `pnpm install`（及 CI 的 `pnpm install --frozen-lockfile`）直接以
> **`ERR_PNPM_IGNORED_BUILDS`** 失败，CI 停在装依赖阶段，
> `lint` / `format:check` / `test` / `build` 全部未执行。
> 排查时注意：**本地 pnpm 版本较旧时可能不复现**（旧版仍读 package.json），
> 需用 CI 实际版本验证：`npx pnpm@<CI版本> install`。

**验证方式：** 删除 `node_modules/.pnpm/better-sqlite3@*` 后重跑 `pnpm install`，
应看到 `better-sqlite3 install$ prebuild-install ... Done` 并生成 `build/Release/better_sqlite3.node`。

---

## 2. Docker 基础镜像不能用 Alpine

**现象：** 容器构建在 better-sqlite3 处卡住或失败。

**根因：** better-sqlite3 的预编译二进制基于 **glibc**，Alpine 是 **musl**，
无法命中预编译包 → 源码编译 → 需要 python3/make/g++，构建极慢且镜像更大。

**规避：** `Dockerfile` 使用 `node:22-bookworm-slim`（Debian，glibc）。
已在 Dockerfile 顶部注释说明，不要"顺手改成 alpine"。

---

## 3. 环境变量默认值必须回写 process.env

**现象：** 明明在 `env.ts` 里给了 `JWT_SECRET` 的默认值，
登录时却报 `JWT_SECRET 缺失或过短`。

**根因：** `config` 对象持有默认值，但 `middleware/auth.ts` 直接读
`process.env.JWT_SECRET`，读到的是 `undefined`。

**规避：** `server/src/env.ts` 末尾显式回写：

```ts
process.env.JWT_SECRET = config.jwtSecret
process.env.DATABASE_URL = config.databaseUrl
process.env.PORT = String(config.port)
```

**注意：** `env.ts` 必须在任何读取 `process.env` 的模块（尤其 `db/index.ts`）**之前**导入，
否则默认值来不及生效。

---

## 4. shared 包改动后必须重新构建

**现象：** 改了 `shared/src/schema/*.ts`，后端 typecheck 仍然报"属性不存在"。

**根因：** 后端以 `@repo/shared` 包形式消费其 **`dist/` 编译产物**；
前端则通过 Vite alias `@shared` 直接引**源码**。两侧机制不同。

**规避：** 改动 shared 后先执行 `pnpm build:shared`；
`pnpm build:server` 与 `pnpm typecheck:server` 已内置该前置步骤。

---

## 5. 事务内不得 await 网络 IO（SQLite 写锁）

**现象：** 订阅同步期间整个系统写入卡住数秒。

**根因：** 若在 `db.transaction()` 内 `await fetch`，**数据库级写锁**会被持有整个网络往返时间，
WAL 模式下写写互斥，所有其他写入排队。

**规避：**

- `better-sqlite3` 的 `db.transaction()` 回调**必须是同步函数**，该 API 约束天然杜绝此问题
- 同步服务拆成两阶段：并发拉取（不持锁）→ 单事务批量写入（1 次 fsync）
- 详见架构 §10 约束 C1/C2 与 `server/src/services/subscription-sync.ts`

---

## 6. 删除客户会级联删除其订阅

**现象：** 冒烟测试中先删客户再删订阅，订阅报 404。

**根因：** `subscriptions.customerId` 外键声明为 `onDelete: 'cascade'`，这是**有意设计**
（客户不存在时其订阅无意义）。

**规避：** 测试与业务代码需按「先订阅、后客户」的顺序删除。
冒烟测试已包含该级联验证用例。

---

## 7. 前端构建会重写 routeTree.gen.ts

**现象：** 改动路由后 typecheck 报"路由不存在"，或 `routeTree.gen.ts` 出现 diff。

**根因：** `@tanstack/router-plugin` 在 vite build/dev 时自动生成该文件。

**规避：**

- **不要手工编辑** `src/routeTree.gen.ts`
- 增删路由文件后先跑一次 `npx vite build`（或 `pnpm dev`）让其重新生成，再跑 `pnpm build`
- 该文件行尾为 LF（仓库经 `.gitattributes` 统一为 LF），git 一般不会提示换行符变化

---

## 8. 沙箱 / CI 环境的限制（非代码缺陷）

| 现象 | 原因 | 处置 |
|------|------|------|
| `wmic.exe` 被安全策略拦截，pnpm 偶发失败 | pnpm Windows 端会调用 wmic 解析存储路径 | 重试即可；非代码问题 |
| **本机 `pnpm install` 通过，CI 却报 `ERR_PNPM_IGNORED_BUILDS`** | **pnpm 版本漂移**：本地 pnpm 10.29.3 仍读 `package.json` 的 `pnpm` 字段，CI 装的是最新版（实测 12.10.1，`store/v11`）不再读 | **锁版本**：CI 用 `npm install -g pnpm@<版本>`；排查时用 `npx pnpm@<CI版本> install` 复现。详见 §11 |
| `pnpm test` 全部失败 | Vitest 为**浏览器模式**，需先 `pnpm test:browser:install` 装 Chromium | 环境准备问题，非代码缺陷 |
| 本机无法 `docker build` | **Windows 宿主无 `docker`**；Docker 仅可经 WSL2 使用（实测 WSL2 Ubuntu 内 `docker 29.9.0` 可用，2026-10-21 复测）。**注意口径**：勿写「已解决」——宿主机上 Docker CLI 依旧缺失，CI（ubuntu runner）与 WSL2 均可跑，Windows 宿主跑不了。凡需 Docker 实跑的项以 **CI 实跑**为准 | 详见 §9 / §10 的两个构建坑；TASK-045 档案 Constraints 的「本机无 Docker」与本行描述一致（同日口径已统一） |
| Prettier 报 CRLF/LF 差异 | **已于 2026-10-10 修复**：Windows 开发机 `core.autocrlf=true` 把工作区检出为 CRLF，而仓库内容与 Prettier 配置均为 LF，造成"本机 format:check 红、CI 绿"的幽灵差异 | **已根治**：仓库新增 `.gitattributes`（`* text=auto eol=lf`），所有平台检出均为 LF，优先于 `core.autocrlf`。若仍遇到旧检出，跑一次 `pnpm format` 即归一 |

---

## 9. Dockerfile 不要带 `# syntax=dockerfile:1` 前端指令

**现象：** 构建在第一步即失败：

```
#3 resolve image config for docker-image://docker.io/library/dockerfile:1
#3 ERROR: pull access denied, repository does not exist or may require authorization:
          server message: insufficient_scope: authorization failed
```

**根因：** `# syntax=dockerfile:1` 要求 Docker 先拉取 BuildKit 前端镜像
`docker.io/library/dockerfile:1`；在**匿名拉取受限 / 限流**的 registry 环境
（如本沙箱）会失败。

**规避：** 删掉该首行。Docker 会改用**守护进程内置的前端解析器**，本项目
Dockerfile 不依赖任何高级前端特性（`COPY`/`RUN`/`ENV` 等通用指令即可）。
2026-10-10 已在 `Dockerfile` 中移除该指令并重新构建通过。

---

## 10. .dockerignore 不能过度排除 `data`

**现象：** 容器内 `tsc` 报 `Cannot find module '../data/schema'`、
`'./data/sidebar-data'`，前端 `pnpm build` 失败；而宿主机 `tsc -b` 却通过。

**根因：** `.dockerignore` 里的 `data` 与 `**/data` 会匹配**任意层级**名为 `data`
的目录，把 `src/features/customers/data/`、`src/features/subscriptions/data/`、
`src/components/layout/data/` 这些**业务源码目录**也一并排除，导致 `COPY . .`
根本不会把它们拷入镜像（宿主机有、镜像里没有 → 模块找不到）。

**规避：** 只排除 SQLite 数据目录（项目根级），用**锚定根级**的写法 `/data`；
保留所有源码 `data` 目录。2026-10-10 已将 `.dockerignore` 的 `data` / `**/data`
改为 `/data` 并重新构建通过。

**教训：** 把源码拷贝进构建上下文时（如 `tar` 排除、`dockerignore`），
也要避免同名目录的过度匹配——两者会叠加导致"宿主机有、镜像无"的诡异差异。

---

## 11. pnpm 版本漂移会让 CI 突然变红

**现象：** 本地 `pnpm install` 一切正常，CI 却在 `Install dependencies` 步骤
即失败：

```
[WARN] The "pnpm" field in package.json is no longer read by pnpm.
       The following keys were ignored: "pnpm.onlyBuiltDependencies".
Error: ERR_PNPM_IGNORED_BUILDS
```

**根因：** CI 用 `npm install -g pnpm`（**不带版本号**）装 pnpm，
拿到的是**当时最新版**，随 pnpm 发版而漂移：

| | pnpm 版本 | store | 是否读 `package.json` 的 `pnpm` 字段 |
|---|---|---|---|
| 本地开发机 | 10.29.3 | `store/v10` | **读**（故本地不复现） |
| CI（2026-10-10 实测） | 12.10.1 | `store/v11` | **不读**（直接失败） |

**快速判别：** 看 CI 日志里的 store 路径。`store/v10` ≈ pnpm 10，
`store/v11` ≈ pnpm 12+。**只要 store 版本比本地新，就说明存在漂移。**

**规避（已于 2026-10-10 落地）：**

1. `ci.yml` 改为 `npm install -g pnpm@12.10.1`，**锁死版本**。
2. 构建脚本白名单从 `package.json` 的 `pnpm.onlyBuiltDependencies`
   迁到 `pnpm-workspace.yaml` 的 `allowBuilds` 映射语法
   （pnpm 10 与 12 均接受该写法，已实测）。
3. `Dockerfile` 本就用 corepack 锁 `pnpm@10.29.3`，且已 `COPY pnpm-workspace.yaml`，
   无需改动。

**排查提示：** 本地复现不了时，用 `npx pnpm@<CI版本> install` 在临时目录复现，
比在真实项目里改配置安全（不会破坏既有 `node_modules`）。

---

## 12. CI 的 `pnpm test` 前必须构建 shared（TASK-026，2026-10-13）

**现象：** CI `install-lint-build` 在 `Run tests` 步骤 exit 1，
`lint` / `format:check` / `Install browsers` 均通过。日志两类信号：

```
(!) Failed to run dependency scan. Skipping dependency pre-bundling.
    @repo/shared (imported by server/src/services/notification-format.ts)
Invalid hook call. Hooks can only be called inside of the body of a
function component. ... You might have more than one copy of React
```

**根因链：** 根 vitest 的默认扫描范围覆盖 `server/`。TASK-025 首次引入
`server/src/services/notification-format.test.ts`，其导入链经 node_modules
链接解析 `@repo/shared` → `shared/dist`（package.json exports 指向编译产物），
而 **CI 从未执行 `pnpm build:shared`**（本地有 dist 故不复现）。dist 缺失 →
Vite 依赖扫描失败 → 跳过预打包 → 浏览器测试中 React 出现多副本 →
**与 server 毫无关系的组件测试也批量挂掉**（confirm-dialog 9/9、
config-drawer 15/15、search-provider 7/8 等）。

**规避（已于 2026-10-13 落地）：** `ci.yml` 在 `Install dependencies` 之后、
`Run tests` 之前新增 `pnpm build:shared` 步骤。

**排查提示：**

- 看到 `Invalid hook call` + `Skipping dependency pre-bundling` 同时出现，
  先查依赖扫描失败的原始 import，不要怀疑组件代码。
- 判别「本地有、CI 无」类差异的通用方法：把可疑产物（如 `shared/dist`）
  临时移走后本地复跑；本坑即以此确定性复现（移走 dist → build:shared →
  受影响测试 27/27 恢复）。
- 新增 `server/` 下测试文件前，确认 CI 链已满足其解析前提（build:shared）。

---

## 13. 订阅同步 403/timeout：如何判定上游原因还是仓库问题（TASK-027，2026-10-13）

**现象：** 部署实例订阅同步失败，错误先从
`The operation was aborted due to timeout` 变为 `上游返回 HTTP 403`。

**判定方法（已实证，结论 = 上游主动拒绝，仓库无直接责任）：**

1. **固化仓库真实请求形态**：用探针脚本（tsx + 本地 HTTP 服务器 +
   真实 `fetchSubscriptionUsage`）记录实际发出的方法与请求头。实测：
   HTTP/1.1、HEAD 优先 + GET 回退、UA 默认 `clash.meta`（订阅可配）、
   `accept: */*`、`accept-encoding: gzip, deflate`、自定义头透传、
   `redirect: follow`——全部为标准请求，无畸形。
2. **核对 git 历史**：`git log --follow` 确认请求构造自初始提交起未变，
   排除「某次改动引入回归」。
3. **结论**：403 是上游（或其 WAF / 代理）的主动拒绝。常见上游原因：
   IP 封禁（此前的超时/重试模式可能触发）、UA 过滤、TLS 指纹（JA3）
   过滤、订阅 token 失效、代理拒绝（配了 proxyUrl 时）。

**仓库侧真实缺陷 = 诊断缺口（已修复，TASK-027）：** 原错误消息
`上游返回 HTTP 403` 不带 URL/方法/响应体，上述原因无法区分。现消息形如：

```
上游返回 HTTP 403（GET https://最终URL，content-type: text/plain，响应体: Sorry, you have been blocked）
```

配代理时附 `，经代理 <proxyUrl>`；超时消息形如
`请求超时（10000ms，HEAD <url>）`。响应体折叠空白并截断 200 字符。

**排查提示：**

- 403 响应体通常直接写明原因（Cloudflare "blocked" / 登录页 / token
  失效文案）——先看响应体，再看是否 `经代理`。
- 用户侧快速验证（在部署机执行，替换 URL）：
  `curl -sS -o /dev/null -D - -A 'clash.meta' '<订阅URL>'` 看状态码与
  响应头；再换浏览器 UA 对比——若浏览器 UA 通而 clash.meta 被拒，
  即上游 UA 过滤，把订阅的 UA 改成浏览器 UA 即可。
- **浏览器模式 vitest 无法 mock 被预打包的 undici**（vitest 已知限制：
  mock 不拦截 optimized deps，真实 undici 又无法在浏览器加载）。
  涉及 undici 的模块，消息级验证抽成纯函数模块（subscription-errors.ts），
  流程级验证走 smoke.ts（node + 真实 undici + 本地 mock 上游）。

---

## 14. 任务编号撞号门禁与两个历史 TASK-045（HD-1 裁决，2026-10-21）

**背景（B1，实测 2026-10-21）：** `tasks/done/TASK-045-review-record-naming` 与
`tasks/review/TASK-045-docker-pipeline-hardening`（现 `done/`）的 Meta **同为 `Task ID: TASK-045`**。
根因：两任务**并发分配编号**时各自实测「044 已占用 → 取 045」，各取各的，撞号。
旧门禁 `scripts/audit-repo.py` 与 `shared/scripts/audit_framework.py` 对「编号 / 唯一 / duplicate」
零检查，此类问题无任何门禁可发现。

**人类裁决（HD-1，2026-10-21，最终决定）：** **不重编**两个历史 `TASK-045`。
理由：编号字面引用遍布 git 历史、PR 描述、`.agents/` 与 `docs/`，改名/加后缀维护成本与
引用破坏面远大于收益。**禁止**任何形式的「假修复」（改 ID、移库、加 `045b` 之类后缀）。

**落地（TASK-047）：** `scripts/audit-repo.py` 新增两条门禁：

- **F9 任务编号唯一性**：解析全部 `tasks/*/TASK-*/TASK.md` 的 Task ID（YAML 与表格两种
  历史形态都认），重复即 FAIL；唯一例外是显式白名单 `F9_HD1_WHITELIST`（两个 045 目录 +
  理由 + 裁决日期，见脚本头注释）。白名单外的任何重复编号必须 FAIL。
- **F8 Merge Record 章节存在性**：TASK-026 起的档案缺 `## Merge Record` 章节即 FAIL
  （TASK-001~025 为制度确立前的历史档案，显式豁免清单见脚本头注释）。

两条检查均已做**反向验证**（故意造缺陷 → FAIL → 复原 → PASS），输出存 TASK-047 交付记录。

**排查提示（给下一个任务的取号者）：**

- 新任务取号前：`find tasks -maxdepth 2 -type d -name "TASK-*"` 实测最大编号，**再加一**；
  若并发分配是常态，取号后立即 `python scripts/audit-repo.py` 自检撞号。
- 两个历史 045 并存属**人工裁决后的合法共存**，不是待清理项；任何「顺手统一编号」的
  重构都是违规改动。
