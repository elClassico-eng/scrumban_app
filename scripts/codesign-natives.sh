#!/usr/bin/env bash
# Ad-hoc re-sign every Mach-O binary inside node_modules.
#
# macOS Tahoe (Darwin 25.x) Gatekeeper SIGKILLs bun-installed native
# binaries that lack a valid code signature — the dev server boots
# fine, then ~5s later the Node process gets killed when fsevents,
# esbuild, lightningcss, etc. are loaded. Ad-hoc signing with the
# `-` identity is enough for local development.
#
# Idempotent. No-op on non-Darwin (Linux CI is unaffected).

set -euo pipefail

[[ "$(uname -s)" == "Darwin" ]] || exit 0
[[ -d node_modules ]] || exit 0

count=0
while IFS= read -r f; do
  if file "$f" 2>/dev/null | grep -q "Mach-O"; then
    xattr -c "$f" 2>/dev/null || true
    codesign --remove-signature "$f" 2>/dev/null || true
    if codesign -s - "$f" 2>/dev/null; then
      count=$((count + 1))
    fi
  fi
done < <(find node_modules \( -name '*.node' -o -path '*/bin/*' \) -type f 2>/dev/null)

echo "codesign-natives: re-signed $count Mach-O binaries"
