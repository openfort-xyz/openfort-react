#!/bin/bash

set -euo pipefail

if command -v gitleaks >/dev/null 2>&1; then
    echo "gitleaks is available for pre-commit secret scanning."
elif [[ "$(uname)" == "Linux" ]] && command -v docker >/dev/null 2>&1; then
    echo "gitleaks is unavailable; the pre-commit hook will use its pinned Docker fallback."
else
    echo "gitleaks is unavailable, so the pre-commit secret scan will block commits."
    echo "Install it manually from https://github.com/gitleaks/gitleaks#installing or provide Docker on Linux."
fi
