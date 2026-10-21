#!/usr/bin/env bash
set -euo pipefail
# Invoked from the checked out deployment, with sudo; never from an HTTP request.
root=/var/lib/clocktimer/diagnostics
node_root=/opt/clocktimer-diagnostics-node
systemctl stop clocktimer-diagnostics.service 2>/dev/null || true
install -d -o daemon -g daemon -m 700 "$root" "$root/jobs" "$root/browsers"
if [ ! -x "$node_root/bin/node" ]; then
  case "$(uname -m)" in x86_64) arch=x64;; aarch64) arch=arm64;; *) echo 'Unsupported runner architecture'; exit 1;; esac
  temporary=$(mktemp -d)
  curl -fsSL --retry 3 https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt -o "$temporary/SHASUMS256.txt"
  package=$(awk "/ linux-$arch[.]tar[.]xz$/ {print \$2; exit}" "$temporary/SHASUMS256.txt")
  # Official lists prefix the archive with node-v<version>-; match that full name.
  if [ -z "$package" ]; then package=$(awk "/node-v[0-9.]+-linux-$arch[.]tar[.]xz$/ {print \$2; exit}" "$temporary/SHASUMS256.txt"); fi
  test -n "$package"
  curl -fsSL --retry 3 "https://nodejs.org/dist/latest-v22.x/$package" -o "$temporary/$package"
  (cd "$temporary" && grep "  $package\$" SHASUMS256.txt | sha256sum -c -)
  install -d -m 755 "$node_root"
  tar -xJf "$temporary/$package" --strip-components=1 -C "$node_root"
  # Only the private mktemp directory created above is removed.
  rm -rf -- "$temporary"
fi
export PATH="$node_root/bin:$PATH"
install -d -o daemon -g daemon -m 700 "$root/runner"
# Keep tracked source and history for FSM reconciliation. No production working files.
source_root="$PWD"
git -c safe.directory="$root/runner" -C "$root/runner" init
git -c safe.directory="$root/runner" -c safe.directory="$source_root" -C "$root/runner" fetch --force "$source_root" HEAD
git -c safe.directory="$root/runner" -C "$root/runner" checkout -f -B diagnostics FETCH_HEAD
cp "$source_root/build-version.json" "$root/runner/build-version.json"
cd "$root/runner"
chown -R daemon:daemon "$root/runner"
sudo -u daemon env PATH="$PATH" npm_config_cache="$root/npm-cache" npm install --prefix tests --no-audit --no-fund
dependency_stamp="$root/playwright-dependencies-1.55.0"
if [ ! -f "$dependency_stamp" ]; then
  node tests/node_modules/playwright/cli.js install-deps chromium
  touch "$dependency_stamp"
fi
sudo -u daemon env PATH="$PATH" PLAYWRIGHT_BROWSERS_PATH="$root/browsers" node tests/node_modules/playwright/cli.js install chromium
install -m 644 deploy/clocktimer-diagnostics.service /etc/systemd/system/clocktimer-diagnostics.service
systemctl daemon-reload
systemctl enable clocktimer-diagnostics.service
systemctl restart clocktimer-diagnostics.service
systemctl --no-pager --full status clocktimer-diagnostics.service
