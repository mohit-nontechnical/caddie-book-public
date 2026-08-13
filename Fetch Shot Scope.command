#!/bin/zsh
# Double-click me: fetches new Shot Scope rounds (screenshots + CSVs) and
# imports them into Caddie Book. First run will ask you to log in once.
set -e
cd "$(dirname "$0")"

echo "── Caddie Book · Shot Scope fetch ──────────────────────"

# Load Turso credentials for the import step
if [ -f .env.local ]; then
  set -a; source .env.local; set +a
else
  echo "warn: no .env.local found — fetch will work, import may fail"
fi

npx -y tsx scripts/fetch-shotscope.mts "$@"

echo ""
echo "All done — press any key to close."
read -k 1 -s
