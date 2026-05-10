#!/usr/bin/env bash
set -euo pipefail
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -sha256 -days 365 -nodes \
  -keyout certs/192.168.1.9-key.pem \
  -out certs/192.168.1.9-cert.pem \
  -subj "/CN=192.168.1.9" \
  -addext "subjectAltName=IP:192.168.1.9,DNS:localhost,IP:127.0.0.1"
echo "证书已生成：certs/192.168.1.9-cert.pem"
echo "iPhone 真机使用自签名 HTTPS 时，需要手动安装并信任该证书。"
