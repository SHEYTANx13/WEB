#!/usr/bin/env bash
#
# Verify that GitHub Pages is configured for the GitHub Actions
# deployment architecture (API build_type "workflow").
#
# This repository deploys exclusively through actions/deploy-pages.
# When Pages is left on "Deploy from a branch" (build_type "legacy"),
# the legacy branch build keeps owning the site and a deploy-pages
# run can never reach "live". There is no fallback: the setting is a
# repository-owner decision that no workflow file can change, so the
# only correct behaviour is to fail immediately and say exactly where
# to fix it.
#
# Output contract:
#   exit 0                -> build_type = workflow; site may deploy
#   exit 1 + ::error::    -> Pages is misconfigured or unreadable
#
# Required environment:
#   GH_TOKEN / GH_REPO  (injected by the workflow)
set -euo pipefail

response_file="$(mktemp)"

http_code="$(
  curl \
    --silent \
    --show-error \
    --location \
    --max-time 20 \
    --header "Authorization: Bearer ${GH_TOKEN:?GH_TOKEN is required}" \
    --header "Accept: application/vnd.github+json" \
    --header "X-GitHub-Api-Version: 2026-03-10" \
    --write-out '%{http_code}' \
    --output "${response_file}" \
    "https://api.github.com/repos/${GH_REPO:?GH_REPO is required}/pages" 2>/dev/null || echo '000'
)"

if [ "${http_code}" = "404" ]; then
  echo "::error::GitHub Pages has no configuration yet for this repository (API 404)."
  echo "::error::Open the exact settings path and pick the required source:"
  echo "::error::  Settings -> Pages -> Build and deployment -> Source -> GitHub Actions"
  rm -f "${response_file}"
  exit 1
fi

if [ "${http_code}" != "200" ]; then
  echo "::error::Unable to read the GitHub Pages configuration (HTTP ${http_code})."
  cat "${response_file}" || true
  rm -f "${response_file}"
  exit 1
fi

build_type="$(
  node -e '
    const fs = require("fs");
    const config = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    process.stdout.write(config.build_type || "legacy");
  ' "${response_file}"
)"

rm -f "${response_file}"

if [ "${build_type}" = "workflow" ]; then
  echo "Pages build_type = workflow (GitHub Actions). Deployment path verified."
  exit 0
fi

if [ "${build_type}" = "legacy" ]; then
  echo "::error::Pages build_type = legacy (Deploy from a branch)."
else
  echo "::error::Pages build_type = '${build_type}' (not 'workflow')."
fi

cat <<'MESSAGE'
::error::This repository deploys with actions/deploy-pages, which requires the
::error::GitHub Pages source to be "GitHub Actions". While Pages is on
::error::"Deploy from a branch", the legacy build keeps owning the site and
::error::this workflow can never deploy. There is no fallback deployment path.
::error::One-time owner fix (cannot be changed from repository files):
::error::  Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
MESSAGE

exit 1
