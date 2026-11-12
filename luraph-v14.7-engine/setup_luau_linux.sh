#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

if ! command -v git >/dev/null 2>&1 || ! command -v cmake >/dev/null 2>&1 || ! command -v g++ >/dev/null 2>&1; then
    echo "Missing Linux build tools. Install git, cmake, and g++ on the host, then run this script again." >&2
    exit 1
fi

python3 build_luau.py --portable

for tool in bin/luau bin/luau-ast; do
    if [ ! -x "$tool" ]; then
        echo "Build did not create executable $tool" >&2
        exit 1
    fi
done

echo "Linux Luau tools are ready in $(pwd)/bin. Restart the bot."
