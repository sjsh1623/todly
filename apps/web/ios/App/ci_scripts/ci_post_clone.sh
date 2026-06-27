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

# Node 20 (matches CI). The Xcode Cloud macOS image ships Homebrew.
brew install node@20
export PATH="$(brew --prefix node@20)/bin:$PATH"
node --version
npm --version

npm ci
npm run build
npx cap sync ios

echo "▸ post-clone done"
