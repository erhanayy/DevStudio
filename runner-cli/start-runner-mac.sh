#!/usr/bin/env bash
# DevStudio 7/24 & Tatil Modu Başlatıcı (macOS)
# Mac'in uykuya geçmesini engeller (caffeinate) ve olası ağ kesintilerinde Runner'ı otomatik yeniden başlatır.

set -u

TOKEN=""
SERVER_URL="${DEVSTUDIO_URL:-https://devstudio-51645421078.europe-west1.run.app}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNNER_FILE="${SCRIPT_DIR}/devstudio-runner.mjs"

for arg in "$@"; do
  case "$arg" in
    --token=*)
      TOKEN="${arg#--token=}"
      ;;
    --server=*)
      SERVER_URL="${arg#--server=}"
      ;;
  esac
done

if [ -z "$TOKEN" ]; then
  TOKEN="${DEVSTUDIO_TOKEN:-}"
fi

if [ -z "$TOKEN" ]; then
  echo "❌ Hata: --token=dev_sec_xxxx parametresi gereklidir."
  echo "Örnek: ./start-runner-mac.sh --token=dev_sec_xxxx"
  exit 1
fi

if [ ! -f "$RUNNER_FILE" ]; then
  echo "⬇️ devstudio-runner.mjs indiriliyor..."
  curl -fsSL "${SERVER_URL}/api/runner/download" -o "$RUNNER_FILE"
fi

echo "🛡️  macOS Uyku Koruması (caffeinate -dims) ve Otomatik Yeniden Başlatma aktif!"
echo "💡 Mac ekranını kısabilirsiniz; kapağı kapatmadan fişte bıraktığınız sürece 7/24 bağlı kalır."

while true; do
  caffeinate -dims node "$RUNNER_FILE" --token="$TOKEN" --server="$SERVER_URL"
  EXIT_CODE=$?
  if [ "$EXIT_CODE" -eq 0 ]; then
    echo "👋 Runner normal şekilde kapatıldı."
    break
  fi
  echo "⚠️  Runner beklenmedik şekilde durdu (kod: $EXIT_CODE). 3 saniye içinde yeniden başlatılıyor..."
  sleep 3
done

