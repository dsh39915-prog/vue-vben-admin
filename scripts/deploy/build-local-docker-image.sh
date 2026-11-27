#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
if [[ "${1:-}" == "--" ]]; then
  shift
fi
IMAGE_NAME="${1:-i4-admin:local}"
LOG_FILE="${SCRIPT_DIR}/build-local-docker-image.log"

# 只构建新镜像，保留当前运行的容器和历史镜像，便于上线及回滚。
docker build "${PROJECT_ROOT}" \
  --file "${SCRIPT_DIR}/Dockerfile" \
  --tag "${IMAGE_NAME}" 2>&1 | tee "${LOG_FILE}"

printf '\nImage built: %s\n' "${IMAGE_NAME}"
printf 'Example: docker run -d -p 8010:8080 --name i4-admin %s\n' "${IMAGE_NAME}"
