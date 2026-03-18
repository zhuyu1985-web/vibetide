#!/bin/bash
# Check page HTTP responses from a running dev server
# Usage: bash check_pages.sh <base_url> <routes_file>
# Output: route STATUS_CODE or route ERROR

BASE_URL="${1:-http://localhost:3000}"
ROUTES_FILE="$2"

if [ -z "$ROUTES_FILE" ]; then
  echo "Usage: bash check_pages.sh <base_url> <routes_file>"
  exit 1
fi

# Remove trailing slash from base URL
BASE_URL="${BASE_URL%/}"

while IFS= read -r route; do
  # Skip empty lines and comments
  [ -z "$route" ] && continue
  [[ "$route" == \#* ]] && continue
  # Skip router config hints
  [[ "$route" == ROUTER_CONFIG:* ]] && continue

  # Skip dynamic routes (contain : or *)
  if [[ "$route" == *":"* ]] || [[ "$route" == *"*"* ]]; then
    echo "$route SKIPPED_DYNAMIC"
    continue
  fi

  url="${BASE_URL}${route}"

  # Fetch with timeout, follow redirects
  status=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 10 "$url" 2>/dev/null)

  if [ $? -ne 0 ]; then
    echo "$route CONNECTION_ERROR"
  else
    echo "$route $status"
  fi
done < "$ROUTES_FILE"
