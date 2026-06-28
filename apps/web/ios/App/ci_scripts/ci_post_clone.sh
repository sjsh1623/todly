#!/bin/sh

# Xcode Cloud post-clone step.
#
# The Capacitor web layer is generated, not committed:
#   - ios/App/App/capacitor.config.json  (holds server.url etc.)
#   - ios/App/App/public/                (offline fallback web bundle)
# Both are gitignored and produced by `npx cap sync`. Without this step the
# Xcode Cloud build would miss server.url (and the web assets), so the shipped
# app would not load the live web app from the server.
#
# Xcode Cloud requires this script to live next to the Xcode project
# (ios/App/ci_scripts/ci_post_clone.sh) and runs it right after cloning.

set -e

echo "▸ post-clone: building web + capacitor sync"

# Xcode Cloud exposes the cloned repo root via CI_PRIMARY_REPOSITORY_PATH.
cd "$CI_PRIMARY_REPOSITORY_PATH/apps/web"

# GoogleService-Info.plist is wired into the Xcode "App" target as a required
# resource but is gitignored, so it's absent on a fresh CI clone and the archive
# would fail with "Build input file cannot be found". Materialize it from the
# base64 Xcode Cloud secret env var GOOGLE_SERVICE_INFO_PLIST_B64. Local builds
# (file already on disk) are untouched.
if [ ! -f ios/App/App/GoogleService-Info.plist ]; then
  if [ -n "$GOOGLE_SERVICE_INFO_PLIST_B64" ]; then
    echo "▸ writing GoogleService-Info.plist from GOOGLE_SERVICE_INFO_PLIST_B64"
    echo "$GOOGLE_SERVICE_INFO_PLIST_B64" | base64 --decode > ios/App/App/GoogleService-Info.plist
  else
    echo "✗ GOOGLE_SERVICE_INFO_PLIST_B64 is not set — the iOS archive will fail." >&2
    exit 1
  fi
fi

# Node 22 — @capacitor/cli requires node >=22. The Xcode Cloud macOS image ships
# Homebrew.
brew install node@22
export PATH="$(brew --prefix node@22)/bin:$PATH"
node --version
npm --version

# Use `npm install`, not `npm ci`: the CI runner is darwin-x64 while the lockfile
# was generated on darwin-arm64, and `npm ci`'s strict optional-dependency check
# rejects esbuild's other-platform binaries (EBADPLATFORM). `npm install` honors
# the lockfile but skips incompatible optional platform packages gracefully.
npm install --no-audit --no-fund
npm run build
npx cap sync ios

echo "▸ post-clone done"
