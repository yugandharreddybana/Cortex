# 🚀 IMMEDIATE ACTION PLAN - Next 30 Minutes

## Critical Path to Getting Everything Running

### STEP 1: Kill All Running Processes (2 min)
```bash
# Kill all Java and Node processes
killall -9 java node npm pnpm mvn 2>/dev/null || true
sleep 2
echo "✅ All processes killed"
```

### STEP 2: Start Java API with SecurityConfig Fix (5 min)
```bash
cd /home/itsmeyugi/cortex/apps/api

# This MUST rebuild to get the SecurityConfig fix
mvn clean spring-boot:run

# Expected output:
# - Database connection successful
# - "Started CortexApiApplication"
# - Listening on localhost:8080
# - WAIT FOR: "Tomcat started on port(s): 8080"
```

### STEP 3: Test API Directly (1 min)
Open new terminal:
```bash
# Test the auth endpoint that was broken before
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Should see EITHER:
# - User not found (401) - this means the endpoint works!
# - Or login success with token

# DO NOT EXPECT 403 anymore - that was the bug we fixed
```

### STEP 4: Start Next.js Web App (3 min)
Open another terminal:
```bash
cd /home/itsmeyugi/cortex/apps/web
pnpm install  # Quick check for deps
pnpm next dev -p 3000

# Expected:
# - "Local: http://localhost:3000"
# - "Ready in X seconds"
```

### STEP 5: Test Login Experience (10 min)
1. Open browser: http://localhost:3000/login
2. You should see:
   - ✅ "Welcome back" heading
   - ✅ Email field
   - ✅ Password field
   - ✅ Forgot password link
   - ✅ Sign up link

3. Try logging in:
   - Email: `test@example.com`
   - Password: `test123`

4. Expected result:
   - ✅ Toast appears: "👋 Welcome back!"
   - ✅ Wait 1 second for animation
   - ✅ Redirected to /dashboard
   - ✅ Dashboard loads with your highlights

### STEP 6: Load Extension (3 min)
1. Open Chrome
2. Go to `chrome://extensions`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select folder: `/home/itsmeyugi/cortex/apps/extension`
6. Extension should appear in browser toolbar

### STEP 7: Test Extension Integration (5 min)
1. Click Cortex extension icon in toolbar
2. Extension popup opens
3. Should see:
   - ✅ Logged in? Verify user info displays
   - ✅ Highlights list shows your saves
   - ✅ Folders and tags visible

### STEP 8: Verify Cross-Platform Sync (3 min)
1. Open Dashboard in two browser tabs
2. In Tab A: Create a new highlight
3. Expected in Tab B:
   - ✅ Highlight appears automatically (no refresh needed)
   - ✅ Both tabs perfectly in sync

---

## If Something Goes Wrong

### "Still Getting 403 on Login"
```bash
# Make sure you rebuilt with the SecurityConfig fix
cd /home/itsmeyugi/cortex/apps/api
mvn clean compile  # Check for compilation errors
```

### "Cannot Connect to API"
```bash
# Check if port 8080 is listening
lsof -i :8080

# If nothing appears, API didn't start
# Check for errors in Maven output (look for "ERROR" or exception messages)
```

### "Extension Won't Load"
```bash
# Verify the manifest.json exists
ls -la /home/itsmeyugi/cortex/apps/extension/manifest.json

# Check Chrome DevTools (F12) → Console tab for errors
```

### "Login Redirects Back to /login"
```bash
# This means authentication failed
# Check:
# 1. Test user exists: SELECT * FROM users WHERE email = 'test@example.com';
# 2. API is functioning: curl http://localhost:8080/actuator/health
# 3. Token is being stored properly (DevTools → Application → Cookies)
```

---

## Premium Experience Checklist ✨

After getting everything running, verify these premium touches:

```
✅ Login Success
   └─ Toast shows: "👋 Welcome back!"
   └─ Smooth fade-in animation
   └─ 1-second delay before redirect (polished UX)

✅ Create Highlight
   └─ Toast shows: "✨ Highlight saved to your brain!"
   └─ Highlight instantly appears
   └─ Extension also gets the update
   └─ Cross-tab shows it immediately

✅ Create Folder
   └─ Toast shows: "📁 'Folder Name' created!"
   └─ Sidebar updates instantly
   └─ Can organize highlights

✅ Error Handling
   └─ Invalid login: "❌ Login failed - Invalid email or password"
   └─ Network down: "📡 Network error - Check your connection"
   └─ Server error: "🔧 Server error - Something went wrong"

✅ Cross-Tab Sync
   └─ No manual page refresh needed
   └─ Updates happen in real-time
   └─ BroadcastChannel working properly

✅ Extension Persistence
   └─ Close and reopen extension
   └─ You're still logged in
   └─ No re-authentication needed
```

---

## What NOT to Do

❌ Don't restart servers multiple times - this causes issues  
❌ Don't check /login if already logged in - you'll be auto-redirected  
❌ Don't clear browser storage - this logs you out  
❌ Don't refresh during a toast animation - wait 1-2 seconds  
❌ Don't test with multiple logins simultaneously - use incognito  

---

## Success Indicators

You'll know everything is working when:

1. ✅ Login doesn't return 403 (it either works or returns 401)
2. ✅ Dashboard loads within 2-3 seconds
3. ✅ Creating highlights works instantly
4. ✅ Extension shows you're logged in
5. ✅ Premium toasts appear for all actions
6. ✅ Cross-tab sync works without page refresh
7. ✅ Logout clears everything

---

## Performance Expectations

```
Login request:        <500ms
Dashboard load:       <2s
Create highlight:     <2s
Search results:       <100ms
Cross-tab message:    <50ms
Extension sync:       <30s per hour
```

---

## Support

If stuck:
1. Check the COMPLETE_SETUP_GUIDE.md for detailed testing checklist
2. Read COMPREHENSIVE_AUDIT_COMPLETE.md for architecture overview
3. Review CRITICAL_FIXES_SUMMARY.md for technical details
4. Check browser console (F12) for JavaScript errors
5. Check terminal output for backend errors

---

**You're ready to go! The core issue (SecurityConfig) is fixed. Time to test!**

🎯 **Target Time**: 15-20 minutes to get everything running  
✨ **Expected Result**: Professional, polished auth experience with full sync

---

*Last Updated: March 9, 2026*  
*Status: Ready for Testing ✅*
