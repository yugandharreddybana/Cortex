#!/bin/bash

# Comprehensive API Testing Suite for Cortex
# This script tests all APIs end-to-end with proper dummy data

set -e

BASE_URL="http://localhost:8080/api/v1"
RESULTS_FILE="/tmp/cortex_api_test_results.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Cleanup previous results
> $RESULTS_FILE

# Helper function to test API endpoint
test_api() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local test_name=$5
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -e "\n${BLUE}[TEST $TOTAL_TESTS] $test_name${NC}"
    echo "Method: $method | Endpoint: $endpoint" >> $RESULTS_FILE
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    echo "Expected Status: $expected_status | Actual Status: $http_code" >> $RESULTS_FILE
    echo "Response: $body" >> $RESULTS_FILE >> $RESULTS_FILE
    
    if [ "$http_code" == "$expected_status" ]; then
        echo -e "${GREEN}✅ PASSED (HTTP $http_code)${NC}"
        echo "$body"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAILED (Expected $expected_status, got $http_code)${NC}"
        echo "Response: $body"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# ============================================================================
# AUTHENTICATION APIs
# ============================================================================
echo -e "\n${YELLOW}═══ AUTHENTICATION APIs ═══${NC}"

# Test 1: Signup
# Use a random email each time
RANDOM_NUM=$RANDOM
test_api "POST" "/auth/signup" \
    "{\"email\":\"testuser${RANDOM_NUM}@example.com\",\"password\":\"Test@12345\",\"fullName\":\"Test User\"}" \
    "200" \
    "Signup new user"

# Extract user info from signup (assuming it returns user data)
USER_EMAIL="testuser${RANDOM_NUM}@example.com"
USER_PASSWORD="Test@12345"

# Test 2: Login
LOGIN_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\"}" \
    "$BASE_URL/auth/login")

echo -e "\n${BLUE}[TEST 2] User Login${NC}"
echo "Method: POST | Endpoint: /auth/login"
HTTP_CODE=$(echo "$LOGIN_RESPONSE" | jq -r '.httpStatus // .status // 200' 2>/dev/null || echo "200")

if echo "$LOGIN_RESPONSE" | jq -e '.token // .accessToken // .user' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASSED - Login successful${NC}"
    echo "$LOGIN_RESPONSE" | jq '.'
    PASSED_TESTS=$((PASSED_TESTS + 1))
    
    # Extract token for authenticated requests
    AUTH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // .accessToken // "test-token"')
else
    echo -e "${RED}❌ FAILED - Login response invalid${NC}"
    echo "Response: $LOGIN_RESPONSE"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    AUTH_TOKEN="test-token"
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# ============================================================================
# HIGHLIGHT APIs
# ============================================================================
echo -e "\n${YELLOW}═══ HIGHLIGHT APIs ═══${NC}"

# Test 3: Create Highlight
HIGHLIGHT_DATA='{"text":"This is a test highlight","source":"https://example.com","tags":[],"note":"Test note","color":"#FFD700"}'

HIGHLIGHT_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d "$HIGHLIGHT_DATA" \
    "$BASE_URL/highlights")

echo -e "\n${BLUE}[TEST 3] Create Highlight${NC}"
echo "Method: POST | Endpoint: /highlights"

if echo "$HIGHLIGHT_RESPONSE" | jq -e '.id // .highlightId' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASSED - Highlight created${NC}"
    echo "$HIGHLIGHT_RESPONSE" | jq '.'
    PASSED_TESTS=$((PASSED_TESTS + 1))
    
    # Extract highlight ID for further tests
    HIGHLIGHT_ID=$(echo "$HIGHLIGHT_RESPONSE" | jq -r '.id // .highlightId // "test-id"')
else
    echo -e "${RED}❌ FAILED - Highlight creation failed${NC}"
    echo "Response: $HIGHLIGHT_RESPONSE"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    HIGHLIGHT_ID="test-id"
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 4: Get All Highlights
test_api "GET" "/highlights" \
    "" \
    "200" \
    "Get all highlights"

# Test 5: Get Highlight by ID
test_api "GET" "/highlights/$HIGHLIGHT_ID" \
    "" \
    "200" \
    "Get highlight by ID"

# Test 6: Update Highlight
UPDATE_HIGHLIGHT_DATA='{"text":"Updated highlight text","note":"Updated note"}'
test_api "PUT" "/highlights/$HIGHLIGHT_ID" \
    "$UPDATE_HIGHLIGHT_DATA" \
    "200" \
    "Update highlight"

# Test 7: Archive Highlight
test_api "PATCH" "/highlights/$HIGHLIGHT_ID/archive" \
    "" \
    "200" \
    "Archive highlight"

# ============================================================================
# FOLDER APIs
# ============================================================================
echo -e "\n${YELLOW}═══ FOLDER APIs ═══${NC}"

# Test 8: Create Folder
FOLDER_DATA='{"name":"Test Folder","emoji":"📚","linkAccess":"RESTRICTED"}'

FOLDER_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d "$FOLDER_DATA" \
    "$BASE_URL/folders")

echo -e "\n${BLUE}[TEST 8] Create Folder${NC}"
echo "Method: POST | Endpoint: /folders"

if echo "$FOLDER_RESPONSE" | jq -e '.id // .folderId' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASSED - Folder created${NC}"
    echo "$FOLDER_RESPONSE" | jq '.'
    PASSED_TESTS=$((PASSED_TESTS + 1))
    
    FOLDER_ID=$(echo "$FOLDER_RESPONSE" | jq -r '.id // .folderId // "test-folder-id"')
else
    echo -e "${RED}❌ FAILED - Folder creation failed${NC}"
    echo "Response: $FOLDER_RESPONSE"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    FOLDER_ID="test-folder-id"
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 9: Get All Folders
test_api "GET" "/folders" \
    "" \
    "200" \
    "Get all folders"

# Test 10: Get Folder by ID
test_api "GET" "/folders/$FOLDER_ID" \
    "" \
    "200" \
    "Get folder by ID"

# Test 11: Update Folder
UPDATE_FOLDER_DATA='{"name":"Updated Folder Name","emoji":"📖"}'
test_api "PUT" "/folders/$FOLDER_ID" \
    "$UPDATE_FOLDER_DATA" \
    "200" \
    "Update folder"

# ============================================================================
# TAG APIs
# ============================================================================
echo -e "\n${YELLOW}═══ TAG APIs ═══${NC}"

# Test 12: Create Tag
TAG_DATA='{"name":"Important","color":"#FF5733"}'

TAG_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d "$TAG_DATA" \
    "$BASE_URL/tags")

echo -e "\n${BLUE}[TEST 12] Create Tag${NC}"
echo "Method: POST | Endpoint: /tags"

if echo "$TAG_RESPONSE" | jq -e '.id // .tagId' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASSED - Tag created${NC}"
    echo "$TAG_RESPONSE" | jq '.'
    PASSED_TESTS=$((PASSED_TESTS + 1))
    
    TAG_ID=$(echo "$TAG_RESPONSE" | jq -r '.id // .tagId // "test-tag-id"')
else
    echo -e "${RED}❌ FAILED - Tag creation failed${NC}"
    echo "Response: $TAG_RESPONSE"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    TAG_ID="test-tag-id"
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 13: Get All Tags
test_api "GET" "/tags" \
    "" \
    "200" \
    "Get all tags"

# Test 14: Get Tag by ID
test_api "GET" "/tags/$TAG_ID" \
    "" \
    "200" \
    "Get tag by ID"

# Test 15: Update Tag
UPDATE_TAG_DATA='{"name":"Updated Important","color":"#FF0000"}'
test_api "PUT" "/tags/$TAG_ID" \
    "$UPDATE_TAG_DATA" \
    "200" \
    "Update tag"

# ============================================================================
# RELATIONSHIP APIs
# ============================================================================
echo -e "\n${YELLOW}═══ RELATIONSHIP APIs ═══${NC}"

# Test 16: Move Highlight to Folder
test_api "PATCH" "/highlights/$HIGHLIGHT_ID/move" \
    "{\"folderId\":\"$FOLDER_ID\"}" \
    "200" \
    "Move highlight to folder"

# ============================================================================
# TEST SUMMARY
# ============================================================================
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}                    TEST SUMMARY${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "Total Tests:  $TOTAL_TESTS"
echo -e "${GREEN}Passed Tests: $PASSED_TESTS${NC}"
echo -e "${RED}Failed Tests: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}✅ ALL TESTS PASSED!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ SOME TESTS FAILED!${NC}"
    echo -e "\nDetailed results saved to: $RESULTS_FILE"
    exit 1
fi
