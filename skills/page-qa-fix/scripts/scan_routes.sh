#!/bin/bash
# Scan project for all page routes across common frameworks
# Usage: bash scan_routes.sh [project_dir]
# Output: One route path per line

PROJECT_DIR="${1:-.}"
cd "$PROJECT_DIR" || exit 1

found_routes=false

# --- Next.js App Router (app/) ---
if [ -d "app" ] || [ -d "src/app" ]; then
  APP_DIR="app"
  [ -d "src/app" ] && APP_DIR="src/app"

  # Find page.tsx/page.jsx/page.js files
  find "$APP_DIR" -name "page.tsx" -o -name "page.jsx" -o -name "page.js" 2>/dev/null | while read -r file; do
    route=$(dirname "$file" | sed "s|^$APP_DIR||" | sed 's|/\[|/:|g' | sed 's|\]||g')
    [ -z "$route" ] && route="/"
    echo "$route"
  done
  found_routes=true
fi

# --- Next.js Pages Router (pages/) ---
if [ -d "pages" ] || [ -d "src/pages" ]; then
  PAGES_DIR="pages"
  [ -d "src/pages" ] && PAGES_DIR="src/pages"

  find "$PAGES_DIR" \( -name "*.tsx" -o -name "*.jsx" -o -name "*.js" \) ! -name "_*" ! -name "api" ! -path "*/api/*" 2>/dev/null | while read -r file; do
    route=$(echo "$file" | sed "s|^$PAGES_DIR||" | sed 's|\.tsx$||;s|\.jsx$||;s|\.js$||' | sed 's|/index$|/|' | sed 's|/\[|/:|g' | sed 's|\]||g')
    [ -z "$route" ] && route="/"
    echo "$route"
  done
  found_routes=true
fi

# --- Nuxt.js (pages/) ---
if [ -f "nuxt.config.ts" ] || [ -f "nuxt.config.js" ]; then
  if [ -d "pages" ]; then
    find pages \( -name "*.vue" \) 2>/dev/null | while read -r file; do
      route=$(echo "$file" | sed 's|^pages||' | sed 's|\.vue$||' | sed 's|/index$|/|' | sed 's|/\[|/:|g' | sed 's|\]||g')
      [ -z "$route" ] && route="/"
      echo "$route"
    done
    found_routes=true
  fi
fi

# --- SvelteKit (src/routes/) ---
if [ -d "src/routes" ]; then
  find src/routes -name "+page.svelte" 2>/dev/null | while read -r file; do
    route=$(dirname "$file" | sed 's|^src/routes||' | sed 's|/\[|/:|g' | sed 's|\]||g')
    [ -z "$route" ] && route="/"
    echo "$route"
  done
  found_routes=true
fi

# --- Remix (app/routes/) ---
if [ -d "app/routes" ]; then
  find app/routes \( -name "*.tsx" -o -name "*.jsx" \) 2>/dev/null | while read -r file; do
    route=$(echo "$file" | sed 's|^app/routes/||' | sed 's|\.tsx$||;s|\.jsx$||' | sed 's|\.|/|g' | sed 's|_index$||' | sed 's|\$|:|g')
    [ "/" != "$route" ] && route="/$route"
    echo "$route"
  done
  found_routes=true
fi

# --- Vite/React Router - check for route config ---
if [ "$found_routes" = false ]; then
  # Look for common router config files
  for f in src/router.tsx src/router.ts src/routes.tsx src/routes.ts src/App.tsx src/App.jsx; do
    if [ -f "$f" ]; then
      echo "ROUTER_CONFIG:$f"
    fi
  done
fi
