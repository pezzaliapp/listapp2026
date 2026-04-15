#!/bin/bash
# ListApp 2026 - Deploy script
# Uso: bash deploy.sh "messaggio commit opzionale"

set -e

COMMIT_MSG="${1:-build: listapp2026 $(date +%Y-%m-%d)}"

echo "=== ListApp 2026 Deploy ==="
echo "Commit: $COMMIT_MSG"
echo ""

# 1. Salva index.html sorgente (PRIMA del build)
cp index.html index.html.src

# 2. Build
echo "→ Build..."
npm run build

echo "→ .nojekyll..."
touch .nojekyll

# 3. Git push
echo "→ Git..."
git add -A
git commit -m "$COMMIT_MSG"
git push origin main

# 4. Ripristina index.html sorgente per prossimo build
cp index.html.src index.html
rm index.html.src

echo ""
echo "✅ Deploy completato!"
echo "   https://pezzaliapp.github.io/listapp2026/"
