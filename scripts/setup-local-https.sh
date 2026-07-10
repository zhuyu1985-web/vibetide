#!/usr/bin/env bash
# 生成本地 HTTPS 证书（local.demo.chinamcloud.cn）
set -euo pipefail

DOMAIN="${LOCAL_HTTPS_DOMAIN:-local.demo.chinamcloud.cn}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="${ROOT}/.certs"

mkdir -p "$CERT_DIR"

generate_with_node_mkcert() {
  echo "→ 使用 node-mkcert 生成 CA + 站点证书..."
  mkcert create-ca \
    --key "${CERT_DIR}/ca.key" \
    --cert "${CERT_DIR}/ca.crt"

  mkcert create-cert \
    --ca-key "${CERT_DIR}/ca.key" \
    --ca-cert "${CERT_DIR}/ca.crt" \
    --domains "${DOMAIN}" "127.0.0.1" "localhost" \
    --key "${CERT_DIR}/${DOMAIN}-key.pem" \
    --cert "${CERT_DIR}/${DOMAIN}.pem"

  cp "${CERT_DIR}/ca.crt" "${CERT_DIR}/rootCA.pem"

  if [[ "$(uname)" == "Darwin" ]]; then
    echo "→ 将 CA 加入 macOS 系统信任（需 sudo）..."
    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${CERT_DIR}/ca.crt" 2>/dev/null || \
      echo "   ⚠ 自动信任失败，可手动双击 ${CERT_DIR}/ca.crt 并设为「始终信任」"
  fi
}

generate_with_filippo_mkcert() {
  echo "→ 使用 filippo mkcert 生成证书..."
  mkcert -install
  mkcert \
    -cert-file "${CERT_DIR}/${DOMAIN}.pem" \
    -key-file "${CERT_DIR}/${DOMAIN}-key.pem" \
    "${DOMAIN}" "127.0.0.1" "localhost"
  cp "$(mkcert -CAROOT)/rootCA.pem" "${CERT_DIR}/rootCA.pem"
}

if ! command -v mkcert >/dev/null 2>&1; then
  echo "❌ 未找到 mkcert。任选其一安装:"
  echo "   brew install mkcert          # filippo 版（推荐）"
  echo "   npm i -g mkcert              # node 版"
  exit 1
fi

if mkcert create-ca --help >/dev/null 2>&1; then
  generate_with_node_mkcert
else
  generate_with_filippo_mkcert
fi

echo ""
echo "✅ 证书已写入 ${CERT_DIR}/"
echo "   请确认 /etc/hosts 含: 127.0.0.1 ${DOMAIN}"
echo "   启动: COREPACK_ENABLE_STRICT=0 pnpm run dev:https"
echo "   访问: https://${DOMAIN}:3000"
echo ""
echo "   建议在 .env.local 设置:"
echo "   NEXT_PUBLIC_SITE_URL=https://${DOMAIN}:3000"
