#!/usr/bin/env bash
# Publish the release build to GitHub Pages (gh-pages branch). Runs the same gates as a CI deploy would.
# Usage: npm run deploy
set -euo pipefail
cd "$(dirname "$0")/.."

npm test
npm run -s check-levels
npm run -s release

rev=$(git rev-parse --short HEAD)
tmp=$(mktemp -d)
trap 'git worktree remove --force "$tmp" 2>/dev/null || true; rm -rf "$tmp"' EXIT

# A worktree on gh-pages (created as an orphan branch the first time).
if git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
  git fetch -q origin gh-pages
  git worktree add -q -B gh-pages "$tmp" origin/gh-pages
else
  git worktree add -q --detach "$tmp"
  (cd "$tmp" && git checkout -q --orphan gh-pages && git rm -rq --cached . && git clean -fdq)
fi

(cd "$tmp" && find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +)
cp -r dist/. "$tmp/"
touch "$tmp/.nojekyll" # serve files as-is
(cd "$tmp" && git add -A && git commit -qm "Deploy $rev" && git push -q origin gh-pages)
echo "Deployed $rev to https://mahmoudalnkeeb.github.io/pixel-hop/"
