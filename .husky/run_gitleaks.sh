#!/bin/bash
set -euo pipefail

# `gitleaks protect` is deprecated as of v8.19; `gitleaks git --staged` replaces
# it. Rules come from .gitleaks.toml, which extends the default ruleset.
if command -v gitleaks >/dev/null 2>&1; then
    gitleaks git --staged --redact -v --config .gitleaks.toml
elif [[ "$(uname)" == "Linux" ]] && command -v docker >/dev/null 2>&1; then
    # The repository is read-only inside the scanner, which needs no network
    # access. The multi-platform image digest identifies the reviewed v8.30.1
    # manifest on both supported Linux architectures.
    docker run --rm --network none -v "$(pwd)":/path:ro \
        -e GIT_CONFIG_COUNT=1 \
        -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0=/path \
        ghcr.io/gitleaks/gitleaks@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f \
        git --staged --redact -v --config /path/.gitleaks.toml /path
else
    echo "gitleaks is not installed and no Docker fallback is available."
    echo "Install it: https://github.com/gitleaks/gitleaks#installing"
    exit 1
fi
