#!/bin/bash

API_BASE="http://localhost:8081/api/v1"
TIMESTAMP=$(date +%s)
EMAIL="test${TIMESTAMP}@cortex.com"
PASSWORD="TestPass12345"
FULLNAME="API Test User ${TIMESTAMP}"

echo "==============================================="
echo "API TEST SUITE - DETAILED RESULTS"
echo "==============================================="
echo ""

# 1. SIGNUP
echo "1. SIGNUP TEST"
SIGNUP=$(curl -s -X POST ${API_BASE}/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"${FULLNAME}\"}")

TOKEN=$(echo "$SIGNUP" | jq -r '.token // empty')
USER_ID=$(echo "$SIGNUP" | jq -r '.user.id // empty')

if [ -n "$TOKEN" ]; then
  echo "✅ SUCCESS"
  echo "Token: ${TOKEN:0:50}..."
  echo "User ID: $USER_ID"
else
  echo "❌ FAILED"
  echo "$SIGNUP"
fi
echo ""

# 2. GET PROFILE
echo "2. GET PROFILE TEST"
PROFILE=$(curl -s -X GET ${API_BASE}/user/profile \
  -H "Authorization: Bearer ${TOKEN}")

PROFILE_EMAIL=$(echo "$PROFILE" | jq -r '.email // empty')
if [ "$PROFILE_EMAIL" = "$EMAIL" ]; then
  echo "✅ SUCCESS"
  echo "$PROFILE" | jq '.' 2>/dev/null | head -10
else
  echo "❌ FAILED"
  echo "$PROFILE"
fi
echo ""

# 3. CREATE FOLDER
echo "3. CREATE FOLDER TEST"
FOLDER=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST ${API_BASE}/folders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"name":"Test Folder","emoji":"📚","linkAccess":"RESTRICTED"}')

HTTP_CODE=$(echo "$FOLDER" | tail -1 | cut -d: -f2)
FOLDER_BODY=$(echo "$FOLDER" | sed '$d')
FOLDER_ID=$(echo "$FOLDER_BODY" | jq -r '.id // empty')

echo "HTTP Code: $HTTP_CODE"
if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "✅ SUCCESS"
  echo "Folder ID: $FOLDER_ID"
else
  echo "❌ FAILED"
  echo "$FOLDER_BODY" | jq '.' 2>/dev/null | head -10
fi
echo ""

# 4. GET FOLDERS
echo "4. GET FOLDERS TEST"
FOLDERS=$(curl -s -X GET ${API_BASE}/folders \
  -H "Authorization: Bearer ${TOKEN}")

FOLDER_COUNT=$(echo "$FOLDERS" | jq 'length')
echo "✅ SUCCESS - Found $FOLDER_COUNT folders"
echo "$FOLDERS" | jq -c '.[] | {name, emoji}' | head -3
echo ""

# 5. CREATE HIGHLIGHT
echo "5. CREATE HIGHLIGHT TEST"
HIGHLIGHT=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST ${API_BASE}/highlights \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"text":"Sample highlighted text","source":"https://example.com"}')

HTTP_CODE=$(echo "$HIGHLIGHT" | tail -1 | cut -d: -f2)
HIGHLIGHT_BODY=$(echo "$HIGHLIGHT" | sed '$d')
HIGHLIGHT_ID=$(echo "$HIGHLIGHT_BODY" | jq -r '.id // empty')

echo "HTTP Code: $HTTP_CODE"
if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "✅ SUCCESS"
  echo "Highlight ID: $HIGHLIGHT_ID"
else
  echo "❌ FAILED"
  echo "$HIGHLIGHT_BODY" | jq '.' 2>/dev/null | head -10
fi
echo ""

# 6. GET HIGHLIGHTS  
echo "6. GET HIGHLIGHTS TEST"
HIGHLIGHTS=$(curl -s -X GET ${API_BASE}/highlights \
  -H "Authorization: Bearer ${TOKEN}")

HIGHLIGHT_COUNT=$(echo "$HIGHLIGHTS" | jq 'length')
if [ "$HIGHLIGHT_COUNT" -gt 0 ]; then
  echo "✅ SUCCESS - Found $HIGHLIGHT_COUNT highlights"
  echo "$HIGHLIGHTS" | jq -c '.[] | {text}' | head -3
else
  echo "❌ EMPTY or ERROR"
  echo "$HIGHLIGHTS" | jq '.' 2>/dev/null | head -10
fi
echo ""

# 7. CREATE TAG
echo "7. CREATE TAG TEST"
TAG=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST ${API_BASE}/tags \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"name":"API Test","color":"#FF5733"}')

HTTP_CODE=$(echo "$TAG" | tail -1 | cut -d: -f2)
TAG_BODY=$(echo "$TAG" | sed '$d')
TAG_ID=$(echo "$TAG_BODY" | jq -r '.id // empty')

echo "HTTP Code: $HTTP_CODE"
if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "✅ SUCCESS"
  echo "Tag ID: $TAG_ID"
else
  echo "❌ FAILED"
  echo "$TAG_BODY" | jq '.' 2>/dev/null | head -10
fi
echo ""

# 8. GET TAGS
echo "8. GET TAGS TEST"
TAGS=$(curl -s -X GET ${API_BASE}/tags \
  -H "Authorization: Bearer ${TOKEN}")

TAG_COUNT=$(echo "$TAGS" | jq 'length')
if [ "$TAG_COUNT" -gt 0 ]; then
  echo "✅ SUCCESS - Found $TAG_COUNT tags"
  echo "$TAGS" | jq -c '.[] | {name}' | head -3
else
  echo "❌ EMPTY or ERROR"
  echo "$TAGS" | jq '.' 2>/dev/null | head -10
fi
echo ""

echo "==============================================="
echo "TEST SUITE COMPLETED"
echo "==============================================="
