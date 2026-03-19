# Cortex Complete Setup & Testing Guide

## Prerequisites

### Environment Variables

**API (.env)** - `/apps/api/.env`
```
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password
JWT_SECRET=your-32-character-jwt-secret
ENCRYPTION_KEY=your-32-character-encryption-key
```

**Web (.env.local)** - `/apps/web/.env.local`
```
JAVA_API_URL=http://localhost:8080
SECRET_COOKIE_PASSWORD=your-32-character-random-password
```

### Database Setup

```sql
-- Create users table if not exists
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    tier VARCHAR(50) DEFAULT 'starter',
    email_hash VARCHAR(255),
    encrypted_email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create test user
INSERT INTO users (email, password_hash, full_name, tier)
VALUES ('test@example.com', '$2a$12$...hashed_password...', 'Test User', 'starter')
ON CONFLICT (email) DO NOTHING;
```

## Server Startup Checklist

### 1. Start API Server
```bash
cd /home/itsmeyugi/cortex/apps/api
mvn clean spring-boot:run
# Expected: Server listens on http://localhost:8080
# Expected: Hibernate DDL-auto creates tables
```

### 2. Start Web App  
```bash
cd /home/itsmeyugi/cortex/apps/web
pnpm install
pnpm next dev -p 3000
# Expected: Server listens on http://localhost:3000
```

### 3. Load Extension
- Open `chrome://extensions`
- Enable "Developer mode"
- Click "Load unpacked"
- Select `/home/itsmeyugi/cortex/apps/extension`

## Testing Checklist

### Authentication Flow

- [ ] **Login Page Load**
  - Login page does NOT call /api/folders or /api/tags
  - "Welcome back" heading is visible
  - Email and password fields appear
  
- [ ] **Login Successful**
  - Enter: test@example.com / password123
  - Toast shows: "👋 Welcome back!"
  - Redirected to /dashboard after 1 second
  - Session cookie `cortex_session` is set (httpOnly, encrypted)
  
- [ ] **Login Failed**
  - Enter invalid credentials
  - Toast shows: "❌ Login failed - Invalid email or password"
  - Page remains on /login
  
- [ ] **Already Logged In**
  - After login, navigate to /login
  - Should redirect to /dashboard automatically
  - No duplicate login requests
  
- [ ] **Session Refresh**
  - Stay on dashboard for 15+ minutes
  - Check that token refresh happens silently
  - Network tab shows /api/auth/refresh calls every 15 minutes

### Extension Sync

- [ ] **Extension Authentication**
  - Extension detects user is logged in
  - Extension can see highlights/folders/tags
  - Extension token is stored in chrome.storage.session
  
- [ ] **Extension Reload Persistence**
  - Login in extension (open popup)
  - Reload extension in dev tools
  - Extension should still show user as logged in
  - No need to re-authenticate
  
- [ ] **Save Highlight from Extension**
  - Open website with content
  - Select text
  - Right-click → "Save to Cortex"
  - Toast: "✨ Highlight saved to your brain!"
  - Highlight appears in extension popup
  - Highlight syncs to dashboard within 2 minutes

### Cross-Tab Sync

- [ ] **Open Dashboard in Two Tabs**
  - Tab A: http://localhost:3000/dashboard
  - Tab B: http://localhost:3000/dashboard
  
- [ ] **Create Highlight in Tab A**
  - Click "New Highlight" button
  - Enter text: "Test highlight"
  - Submit
  - Toast appears in Tab A: "✨ Highlight saved!"
  
- [ ] **Verify in Tab B**
  - Tab B automatically updates with new highlight
  - No page reload needed
  - BroadcastChannel worked correctly
  
- [ ] **Edit in Tab B**
  - Edit the highlight in Tab B
  - Tab A updates automatically
  - Both tabs stay in sync

### Dashboard Functionality

- [ ] **View All Highlights**
  - Dashboard loads highlights list
  - Each highlight shows: text, source, date, tags
  - Highlights load without spinner after 2-3 seconds
  
- [ ] **Filter by Folder**
  - Click folder in sidebar
  - Only highlights in that folder show
  - Breadcrumb shows selected folder
  
- [ ] **Search**
  - Use Cmd+K to open search (or Ctrl+K on Linux)
  - Type search term
  - Results appear instantly
  - Results highlight matched text
  
- [ ] **Create Folder**
  - Click "New Folder"
  - Enter name: "Test Folder"
  - Confirm
  - Toast: "📁 'Test Folder' created!"
  - Folder appears in sidebar
  
- [ ] **Delete Folder**
  - Right-click folder
  - Click delete
  - Confirm dialog
  - Toast: "📁 'Test Folder' removed"
  - Folder disappears from sidebar
  
- [ ] **Add Tag**
  - Click "+" next to Tags section
  - Enter: "learning"
  - Toast: "🏷️ Tag 'learning' added!"
  - Tag appears in tag list
  
- [ ] **Tag a Highlight**
  - Click highlight
  - Click "Add tag"
  - Select "learning"
  - Highlight gets the tag badge
  - Tag count updates

### Offline Functionality

- [ ] **Create While Offline**
  - Disconnect internet
  - Create new highlight
  - Toast: "💾 Offline mode - syncing when back online"
  - Highlight appears locally
  
- [ ] **Reconnect & Sync**
  - Reconnect internet
  - Toast: "🔄 Syncing data..."
  - Toast: "☁️ All synced!"
  - Highlight should be on server now
  
- [ ] **Offline Modifications**
  - Modify highlight while offline
  - Modify in different tab
  - When online, no conflicts (LWW wins)

### Error Handling

- [ ] **Network Timeout**
  - Disable network
  - Try to save highlight
  - Toast: "📡 Network error - Check your connection"
  
- [ ] **Server Error**
  - API returns 500
  - Toast: "🔧 Server error - Something went wrong"
  
- [ ] **Session Expired**
  - API returns 401
  - Toast: "⏰ Session expired - Please log in again"
  - Redirect to /login
  
- [ ] **Invalid Response**
  - API returns malformed JSON
  - Toast: "Invalid server response"

## API Response Formats

### Login Success
```json
{
  "success": true,
  "user": {
    "email": "test@example.com",
    "tier": "starter"
  }
}
```

### Login Error
```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

### Get Highlights
```json
[
  {
    "id": "uuid",
    "text": "Highlight text",
    "source": "Page title",
    "url": "https://...",
    "tags": ["tag1"],
    "savedAt": "2026-03-09T...",
    "isFavorite": false
  }
]
```

## Troubleshooting

### 500 Error on Login
1. Check SecurityConfig allows `/api/v1/auth/**`
2. Check database connection
3. Check JWT_SECRET is set to 32+ characters
4. Check user exists in database

### Extension Not Storing Token
1. Check extension manifest has "storage" permission
2. Check chrome.storage.session/local work in DevTools
3. Try clearing all extension storage and re-login

### Cross-Tab Sync not Working
1. Check browser supports BroadcastChannel
2. Check both tabs are on same origin
3. Check there are no CORS errors
4. Check Firefox has enabled BroadcastChannel if needed

### No Highlights After Login
1. Check /api/highlights returns 200
2. Check highlights array is not empty
3. Check useServerSync hook is called
4. Check SessionGuard is wrapping dashboard

## Performance Benchmarks

- Login request: < 500ms
- Load highlights: < 1s
- Create highlight: < 2s (with sync)
- Search results: < 100ms
- Extension sync: < 30s per cycle

## Security Checklist

- [ ] JWT tokens stored in httpOnly cookies
- [ ] All StorageÏ encrypted with AES-256
- [ ] Extension tokens refreshed hourly
- [ ] CORS properly configured
- [ ] Sensitive fields (passwords) never logged
- [ ] Session timeouts after 2 hours inactivity

---

Last Updated: March 9, 2026
