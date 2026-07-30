#!/bin/bash

if command -v gitleaks &> /dev/null; then
    echo "gitleaks already installed"
    exit 0
fi

if [[ "$(uname)" == "Darwin" ]]; then
    echo "Running on macOS"
    if command -v brew &> /dev/null; then
        brew install gitleaks
        exit 0
    else
        echo "Homebrew not installed! Please install homebrew and try again"
        echo "run the following command in your terminal"
        echo "/bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
elif [[ "$(uname)" == "Linux" ]]; then
    # Not packaged in apt; the commit hook falls back to the Docker image.
    exit 0
else
    echo "Please install gitleaks manually"
    echo "https://github.com/gitleaks/gitleaks#installing"
    exit 1
fi
