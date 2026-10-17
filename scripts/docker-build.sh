#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# 本地构建脚本 —— 与 .github/workflows/docker.yml 共用同一套参数，
# 避免本地裸 `docker build` 与 CI（buildx / 多架构 / 标签规则 / 缓存）漂移。
#
# 默认【只构建、不推送】（防误推）；要推送到 DockerHub 须显式加 --push。
#
# 与 CI 一致的点：
#   - platforms：linux/amd64,linux/arm64
#   - 标签规则：仅 sha-<short>（对应 CI 的 type=sha,format=short）；
#     本脚本【不】打 latest / 版本号 —— 那些只在打版本 tag 发布时产生
#     （合并即构建只出 sha-*，见 docker.yml 文件头）。
#   - 缓存语义：buildx + registry 缓存（mode=max），与 CI 的 gha 缓存同构。
#
# 推送凭据只从环境变量读取，不设默认值、不打印、不写入任何文件：
#   DOCKERHUB_USERNAME  DockerHub 用户名（也用于拼接镜像名）
#   DOCKERHUB_TOKEN     DockerHub Access Token（需 Read & Write 权限）
# ---------------------------------------------------------------------------
set -euo pipefail

PLATFORMS="linux/amd64,linux/arm64"   # 与 docker.yml 的 platforms 一致
# 镜像名：优先用 DOCKERHUB_USERNAME 作命名空间；未设置时退化为本地标签 subscription-admin。
# 这不是给凭据设默认值 —— 真正的推送凭据在下方用 :? 强校验，缺失即报错。
IMAGE_REPO="${DOCKERHUB_USERNAME:+${DOCKERHUB_USERNAME}/}subscription-admin"
CACHE_REF="${IMAGE_REPO}:buildcache"

PUSH=false
for arg in "$@"; do
  case "$arg" in
    --push) PUSH=true ;;
    -h|--help)
      echo "用法: $0 [--push]"
      echo "  默认只构建（多架构，产物保留在 buildx 缓存，不导出到本地 docker、不推送）。"
      echo "  --push  构建并推送到 DockerHub（需环境变量 DOCKERHUB_USERNAME / DOCKERHUB_TOKEN）。"
      exit 0
      ;;
    *)
      echo "未知参数: $arg（用 --help 查看用法）" >&2
      exit 2
      ;;
  esac
done

# 多架构构建需要 docker-container 驱动的 buildx 构建器（默认 docker 驱动不支持多平台）。
# 这里按需创建一个并切过去，等价于 CI 的 docker/setup-buildx-action；幂等，可重复运行。
if ! docker buildx inspect multiarch >/dev/null 2>&1; then
  docker buildx create --name multiarch --driver docker-container >/dev/null
fi
docker buildx use multiarch

# 短 SHA 标签：与 CI 的 type=sha,format=short 一致
SHA_TAG="$(git rev-parse --short HEAD)"
TAG="${IMAGE_REPO}:sha-${SHA_TAG}"

echo "镜像仓库: ${IMAGE_REPO}"
echo "目标标签: ${TAG}"
echo "构建平台: ${PLATFORMS}"

if [ "$PUSH" = true ]; then
  # 凭据强校验：只从环境变量读，缺失即报错（不设默认值、不打印 token）
  : "${DOCKERHUB_USERNAME:?--push 需要环境变量 DOCKERHUB_USERNAME}"
  : "${DOCKERHUB_TOKEN:?--push 需要环境变量 DOCKERHUB_TOKEN}"

  echo "登录 DockerHub（用户 ${DOCKERHUB_USERNAME}）..."
  # token 经 stdin 传入，不出现在进程参数或日志中
  printf '%s' "$DOCKERHUB_TOKEN" | docker login --username "$DOCKERHUB_USERNAME" --password-stdin

  echo "构建并推送（多架构 + registry 缓存 mode=max）..."
  docker buildx build \
    --platform "$PLATFORMS" \
    --tag "$TAG" \
    --cache-from "type=registry,ref=${CACHE_REF}" \
    --cache-to "type=registry,ref=${CACHE_REF},mode=max" \
    --provenance=false \
    --push \
    .
  echo "✅ 已构建并推送: ${TAG}"
else
  # 仅构建：多架构产物保留在 buildx 缓存中（未导出到本地 docker、未推送）。
  # registry cache-from 为尽力而为，读取不到仅告警、不中断。
  echo "仅构建（不推送）：多架构产物保留在 buildx 缓存中，未导出、未推送。"
  docker buildx build \
    --platform "$PLATFORMS" \
    --tag "$TAG" \
    --cache-from "type=registry,ref=${CACHE_REF}" \
    --provenance=false \
    .
  echo "✅ 构建完成（未推送）: ${TAG}"
fi
