#!/bin/bash
set -e

# Directory wherelibs will be stored
LIBS_DIR="modules/crispy-native-core/android/libs"
mkdir -p "$LIBS_DIR"

JLIBTORRENT_VERSION="2.0.12.7"
BASE_URL="https://github.com/frostwire/frostwire-jlibtorrent/releases/download/release%2F${JLIBTORRENT_VERSION}"

echo "📥 Downloading jlibtorrent v${JLIBTORRENT_VERSION} to ${LIBS_DIR}..."

download_jar() {
    local filename="$1"
    local url="${BASE_URL}/${filename}"
    local output="${LIBS_DIR}/${filename}"
    
    if [ ! -f "$output" ]; then
        echo "  Downloading ${filename}..."
        curl -L -o "$output" "$url"
    else
        echo "  ${filename} already exists, skipping."
    fi
}

download_jar "jlibtorrent-${JLIBTORRENT_VERSION}.jar"
download_jar "jlibtorrent-android-arm-${JLIBTORRENT_VERSION}.jar"
download_jar "jlibtorrent-android-arm64-${JLIBTORRENT_VERSION}.jar"
download_jar "jlibtorrent-android-x86-${JLIBTORRENT_VERSION}.jar"
download_jar "jlibtorrent-android-x86_64-${JLIBTORRENT_VERSION}.jar"

echo "✅ jlibtorrent download complete."
