#!/bin/bash
# GitHub push script — run this from the Shell tab
echo "Pushing all changes to GitHub..."

cd /home/runner/workspace

# Set git identity
git config user.email "gojo-voice@replit.com" 2>/dev/null || true
git config user.name "Replit Agent" 2>/dev/null || true

# Force push (our local code is the truth)
GIT_TERMINAL_PROMPT=0 git push \
  "https://${GITHUB_ACCESS_TOKEN}@github.com/blcobra8585-debug/voice-ai-app.git" \
  main --force

echo ""
echo "Done! Check https://github.com/blcobra8585-debug/voice-ai-app"
