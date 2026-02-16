#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ASSETS_DIR="$ROOT_DIR/modules/crispy-native-core/android/src/main/assets/torrserver"

TAG="MatriX.137"
BASE_URL="https://github.com/YouROK/TorrServer/releases/download/${TAG}"

declare -A FILES=(
  [arm64]="TorrServer-android-arm64"
  [arm7]="TorrServer-android-arm7"
  [amd64]="TorrServer-android-amd64"
  [386]="TorrServer-android-386"
)

declare -A SHA256=(
  [arm64]="5f7679d3dfb6d5e51781b85d4579cfa509fbd887f3f0c98f49d49a47459139b3"
  [arm7]="4382fd692467bfd33d723696932b0990fe5720cf2fcc52bb47db5fdb4462ecd8"
  [amd64]="6fa874d2b00ce7006b7f61cc775252e84feb2de0a41492f149eaca3c962a9725"
  [386]="52a1a41f53a5270d6aa67cb95c41260e22ad7511b38599fecd9e4df096799d62"
)

mkdir -p "$ASSETS_DIR"

for abi in "${!FILES[@]}"; do
  file_name="${FILES[$abi]}"
  target_dir="$ASSETS_DIR/$abi"
  target_path="$target_dir/torrserver"
  tmp_path="$target_path.tmp"

  mkdir -p "$target_dir"
  echo "Downloading $file_name for ABI $abi"
  curl -fsSL "${BASE_URL}/${file_name}" -o "$tmp_path"

  actual_sha="$(sha256sum "$tmp_path" | awk '{print $1}')"
  expected_sha="${SHA256[$abi]}"
  if [[ "$actual_sha" != "$expected_sha" ]]; then
    echo "SHA256 mismatch for $file_name"
    echo "  expected: $expected_sha"
    echo "  actual:   $actual_sha"
    exit 1
  fi

  mv "$tmp_path" "$target_path"
  chmod +x "$target_path"
done

echo "TorrServer binaries downloaded and verified in $ASSETS_DIR"
