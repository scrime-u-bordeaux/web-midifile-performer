#!/bin/sh

git config core.hooksPath .githooks
chmod 744 .githooks/pre-commit
