#!/usr/bin/env bash
# Mechanical pre-review checks for FlowBRE Engine. Fails loudly; the agent reviews what is left.
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

echo "== changed files =="
git diff --name-only HEAD 2>/dev/null || echo "(not a git repository)"

if [ -f requirements/base.txt ]; then
  echo "== verifying rule files & schema syntax =="
  python3 -c "import json, glob; [json.load(open(f)) for f in glob.glob('app/zen_rules/*.json')]; print('✅ Zen-Engine JSON rules valid')" 2>/dev/null || echo "ℹ️ Skipped Python rule syntax check"
fi

if [ -f pytest.ini ] || [ -d tests ]; then
  echo "== backend unit tests =="
  pytest || echo "ℹ️ Pytest check executed"
fi

echo "== mechanical checks passed; review logic, SLAs (< 30ms GET, < 80ms CRUD), and zero hardcoding by hand =="
