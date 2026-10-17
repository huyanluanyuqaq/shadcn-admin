# Docker 镜像构建与发布（docker-release）

> 本文件说明 `subscription-admin` 镜像的**构建触发方式、标签规则、失败排查与配置项**。
> 对应工作流：`.github/workflows/docker.yml`；本地等价入口：`scripts/docker-build.sh`。

镜像地址：`docker.io/<DOCKERHUB_USERNAME>/subscription-admin`

---

## 1. 触发方式（三种）

| 触发 | 事件 | 产出标签 | 语义 |
|------|------|---------|------|
| **合并/推送到 `main`** | `push` → `branches: [main]` | `sha-<short>` | **合并即构建**：每次合并自动产出可追溯镜像，便于回滚到「某次合并的镜像」。**不**推进 `latest` / 版本号。 |
| **打版本 tag** | `push` → `tags: [v*]`（形如 `v1.2.3`） | `v1.2.3` + `latest` + `sha-<short>` | **对外发布**：把某版本推成线上最新。属需授权的显式动作。 |
| **手动触发** | `workflow_dispatch` | 从分支触发只出 `sha-<short>`；从 tag 触发同「打 tag 发布」 | 在 Actions 页面任选分支/tag 运行。 |

> `branches` 与 `tags` 在 GitHub Actions 中是**「或」关系**：任一匹配即触发。

---

## 2. 标签规则

- `sha-<short>`：每次 `main` 合并与每次发布都会生成，指向当次提交的短 SHA，用于追溯与回滚。
- `latest`：**仅在打版本 tag 时前进**。
- `vX.Y.Z`：仅在打对应 semver tag 时生成精确版本号镜像（不额外生成 `v1` / `v1.0` 浮动标签）。

---

## 3. 为什么 `latest` 不随合并前进

`latest` 标签带有门禁（`docker.yml` 的 metadata 段）：

```
type=raw,value=latest,enable=${{ github.ref_type == 'tag' }}
```

`enable` 表达式的含义是「仅当 `github.ref_type == 'tag'` 时才允许生成/更新 `latest`」。
`main` 分支推送时 `github.ref_type` 为 `branch`，故合并**只产出 `sha-*`，不触碰 `latest`**。

这样「合并」保持低风险动作，而「把某版本推成线上最新」仍是**需授权的打 tag 动作**——
即「合并不等于发布」。

> **本工作流不含任何自动打 tag 逻辑。** GitHub 的递归防护使工作流内推送的 tag 不触发它自身，
> 「合并→自动打 tag→构建」需引入额外长期凭据（PAT），该方案已被否决，tag 仍由人工按需打。

---

## 4. 配置项

### GitHub Secrets（仓库 Settings → Secrets and variables → Actions）

| 名称 | 用途 |
|------|------|
| `DOCKERHUB_USERNAME` | DockerHub 用户名，兼作镜像命名空间 |
| `DOCKERHUB_TOKEN` | DockerHub Access Token（需 **Read & Write** 权限） |

> 只存**名称与权限要求**，切勿把 token 值写进仓库、日志或文档。

### 本地环境变量（同名）

本地用 `scripts/docker-build.sh` 构建时，同样从这两个环境变量读取推送凭据：

```bash
export DOCKERHUB_USERNAME=你的用户名
export DOCKERHUB_TOKEN=你的访问令牌
./scripts/docker-build.sh          # 只构建，不推送
./scripts/docker-build.sh --push   # 构建并推送（需上面两个环境变量）
```

脚本与 CI 共用同一套参数（`platforms=linux/amd64,linux/arm64`、`sha-<short>` 标签、
registry 缓存 `mode=max`），**默认只构建不推送**，避免本地误推。

---

## 5. 重试行为

`build-and-push` 步骤对「构建 + 推送」整体做退避重试：

- **总尝试 3 次**（1 次首发 + 2 次重试）；
- **递增退避**：第 1 次重试前等 30s，第 2 次重试前等 60s（避免连续撞同一故障）；
- 每次尝试都有 `::group::` 日志，标明「第 N/3 次尝试」。

> 说明：`docker/build-push-action@v6` 无原生 retry 输入，故用「包裹步骤 + 循环」直接调用
> `docker buildx build`，参数与原 action 等价（context / push / platforms / tags / labels /
> cache-from / cache-to）。多架构经 QEMU 模拟，**单次构建可能耗时 10~20 分钟，属正常**，
> 不要因耗时长误判为失败。

---

## 6. 失败排查

重试耗尽后，日志会输出「失败阶段判定」，分两类：

| 阶段 | 典型原因 | 处置 |
|------|---------|------|
| **构建（编译/依赖安装）** | 代码编译错、`Dockerfile` 错、`pnpm install` 失败 | 重试通常无效，需修代码或 Dockerfile |
| **推送（网络/认证）** | DockerHub 网络抖动、`DOCKERHUB_TOKEN` 失效或权限不足 | 可直接重跑；检查 Secret 是否在位、token 是否 Read & Write |

排查步骤：

1. 看作业日志末尾的「失败阶段判定」与「最后一次尝试的末尾日志」，先定位是构建还是推送。
2. 若为推送/认证：确认 `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` 两个 Secret 在位且未过期。
3. 若为构建：本地用 `./scripts/docker-build.sh`（不推）复现编译问题。
4. 确认无误后可在 Actions 页面 `workflow_dispatch` 手动重跑对应分支/tag。
