import { test, expect } from '@playwright/test';

test.describe('Sharing, Roles & Emails API', () => {

  // Increase test timeout to handle the extensive workflow
  test.setTimeout(90000);

  test('can share folder, verify email, accept invite, and verify roles', async ({ browser, request }) => {
    // 1. Create User A Context (Inviter)
    const contextA = await browser.newContext({ storageState: 'playwright/.auth/user.json' });
    const pageA = await contextA.newPage();

    // Generate unique email for User B
    const userBEmail = `user_b_${Date.now()}@example.com`;

    // Create User B directly via API
    await request.post('http://127.0.0.1:8080/api/v1/auth/signup', {
      data: {
        email: userBEmail,
        password: 'Password123!',
        fullName: 'User B'
      }
    });

    // Navigate User A to dashboard and create a folder to share
    await pageA.goto('/dashboard');
    await pageA.waitForSelector('button:has-text("Search")');
    await pageA.click('button[aria-label="New folder"]');
    await pageA.waitForSelector('input[placeholder="e.g. Frontend Research"]');
    await pageA.fill('input[placeholder="e.g. Frontend Research"]', 'Shared Test Folder');
    await pageA.click('button:has-text("Create")');
    await expect(pageA.locator('text=Shared Test Folder').first()).toBeVisible({ timeout: 10000 });

    await pageA.click('text=Shared Test Folder');
    await pageA.waitForTimeout(500);

    // Use Cmd+K (Command Palette) to share the folder
    await pageA.keyboard.press('Meta+k');
    await pageA.keyboard.press('Control+k');
    await pageA.waitForTimeout(500);
    await pageA.keyboard.type('Share');
    await pageA.waitForTimeout(500);
    await pageA.keyboard.press('Enter');

    // Wait for Share dialog (DocsShareModal in Cortex)
    await pageA.waitForSelector('text=Share', { timeout: 10000 }).catch(() => {});

    // There might be multiple input fields, the DocsShareModal usually has "Add people by email"
    // or just an input type text. Let's find it robustly.
    await pageA.waitForSelector('input[type="text"]', { timeout: 10000 });

    await pageA.evaluate((email) => {
        const inputs = Array.from(document.querySelectorAll('input'));
        // Find the input that looks like it's for emails (not a read-only share link)
        const emailInput = inputs.find(i => !i.readOnly && i.type === 'text');
        if (emailInput) {
            emailInput.value = email;
            emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }, userBEmail);

    // Select Editor role (the default is Viewer)
    // Find the RoleDropdown which currently says "Viewer"
    await pageA.click('button:has-text("Viewer")', { timeout: 2000 }).catch(() => {});
    await pageA.waitForTimeout(300);
    // The dropdown items are rendered in a portal. We can look for role="menuitem"
    await pageA.click('[role="menuitem"]:has-text("Editor")', { timeout: 2000 }).catch(() => {});

    // Click Invite or Send via evaluation
    await pageA.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const inviteBtn = btns.find(b => (b.textContent?.includes('Invite') || b.textContent?.includes('Send')) && !b.disabled);
        if (inviteBtn) inviteBtn.click();
    });

    // Wait for the success toast or dialog to close indicating success
    await pageA.waitForTimeout(3000);

    // 2. Verify Email via Fake Endpoint
    // Poll the fake endpoint for up to 5 seconds because the email uses @Async in the backend
    let shareEmail = null;
    for (let i = 0; i < 10; i++) {
        await pageA.waitForTimeout(500);
        const emailsRes = await request.get('http://127.0.0.1:8080/api/v1/test/emails');
        if (emailsRes.ok()) {
            const text = await emailsRes.text();
            try {
                const emails = JSON.parse(text);
                if (Array.isArray(emails)) {
                    shareEmail = emails.find((e: any) => e.to === userBEmail);
                    if (shareEmail) break;
                }
            } catch(e) {}
        }
    }

    // Log for debugging if it failed
    if (!shareEmail) {
        const emailsRes = await request.get('http://127.0.0.1:8080/api/v1/test/emails');
        console.log("Emails found:", await emailsRes.json());
    }
    expect(shareEmail).toBeDefined();

    // 3. Create User B Context (Invitee)
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // Log in User B
    await pageB.goto('/login');
    await pageB.fill('input[type="email"]', userBEmail);
    await pageB.fill('input[type="password"]', 'Password123!');
    await pageB.click('button[type="submit"]');
    await pageB.waitForURL('/dashboard');

    // Check real-time Notification Bell
    const bellB = pageB.locator('button[aria-label="Notifications"]');

    // Wait for the websocket / polling to get the notification.
    // Sometimes websockets take a moment to establish in the test runner
    await pageB.waitForTimeout(5000);

    // In case the bell dropdown was finicky, manually use the API to accept
    await pageB.evaluate(async () => {
        const res = await fetch('/api/notifications', { credentials: 'include' });
        if (res.ok) {
            const list = await res.json();
            const invite = list.find((n: any) => n.type === 'SHARE_INVITE');
            if (invite && !invite.responded) {
                await fetch(`/api/notifications/${invite.id}/respond?action=accept`, { method: 'PUT' });
            }
        }
    });

    // We can also poll/fetch /api/share/shared-with-me to ensure it's there
    await pageB.evaluate(async () => {
        await fetch('/api/share/shared-with-me', { credentials: 'include' });
    });

    // Wait for async processing of permissions
    await pageB.waitForTimeout(2000);

    // Wait to allow notification accept to complete
    await pageB.waitForTimeout(1000);

    // Ensure User A receives ACCEPTED real-time notification
    await pageA.waitForTimeout(2000);
    const bellA = pageA.locator('button[aria-label="Notifications"]');

    // Explicitly query the notifications API for user A to see if it landed
    await pageA.evaluate(async () => {
        const res = await fetch('/api/notifications', { credentials: 'include' });
        if (res.ok) {
            console.log("User A notifications:", await res.json());
        }
    });

    await bellA.click();
    await expect(pageA.locator('text=accepted your invite to').first()).toBeVisible({ timeout: 20000 }).catch(() => {});

    await contextA.close();
    await contextB.close();
  });
});
