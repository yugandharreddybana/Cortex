import axios from 'axios';

const BASE = 'http://localhost:8080/api/v1';
let token = '';

export interface FlowResult {
  flow: string;
  status: 'pass' | 'fail' | 'skip';
  error?: string;
  durationMs?: number;
}

export const results: FlowResult[] = [];

async function run(flow: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({ flow, status: 'pass', durationMs: Date.now() - start });
    console.log(`  ✅ PASS: ${flow} (${Date.now() - start}ms)`);
  } catch (e: any) {
    const error = e?.response?.data ?? e?.message ?? String(e);
    results.push({ flow, status: 'fail', error: JSON.stringify(error), durationMs: Date.now() - start });
    console.error(`  ❌ FAIL: ${flow}`, JSON.stringify(error).slice(0, 120));
  }
}

export async function runAllFlows(): Promise<FlowResult[]> {
  results.length = 0; // reset between runs
  const testEmail = `qa_${Date.now()}@cortex.test`;
  const testPassword = 'Test@1234!';

  console.log('\n── Auth Flows ──────────────────────────');
  await run('Signup', async () => {
    await axios.post(`${BASE}/auth/signup`, { email: testEmail, password: testPassword, name: 'QA Bot' });
  });

  await run('Login', async () => {
    const res = await axios.post(`${BASE}/auth/login`, { email: testEmail, password: testPassword });
    token = res.data.accessToken;
    if (!token) throw new Error('No access token returned');
  });

  await run('Refresh Token', async () => {
    await axios.post(`${BASE}/auth/refresh-token`, {}, { headers: { Authorization: `Bearer ${token}` } });
  });

  const auth = () => ({ headers: { Authorization: `Bearer ${token}` } });

  console.log('\n── User Profile Flows ───────────────────');
  await run('Get Profile', async () => {
    const res = await axios.get(`${BASE}/user/profile`, auth());
    if (!res.data.email) throw new Error('Profile missing email');
  });

  await run('Update Profile', async () => {
    await axios.put(`${BASE}/user/profile`, { name: 'QA Bot Updated' }, auth());
  });

  await run('Change Password', async () => {
    await axios.post(`${BASE}/user/change-password`, {
      currentPassword: testPassword,
      newPassword: testPassword,
    }, auth());
  });

  console.log('\n── Folder Flows ─────────────────────────');
  let folderId: string = '';
  let childFolderId: string = '';

  await run('Create Root Folder', async () => {
    const res = await axios.post(`${BASE}/folders`, { name: 'QA Root Folder', emoji: '🧪' }, auth());
    folderId = res.data.id;
    if (!folderId) throw new Error('No folder ID returned');
  });

  await run('Create Child Folder (nested)', async () => {
    const res = await axios.post(`${BASE}/folders`, { name: 'QA Child Folder', emoji: '📁', parentId: folderId }, auth());
    childFolderId = res.data.id;
  });

  await run('Get All Folders', async () => {
    const res = await axios.get(`${BASE}/folders`, auth());
    if (!Array.isArray(res.data)) throw new Error('Expected array of folders');
  });

  await run('Update Folder', async () => {
    await axios.put(`${BASE}/folders/${folderId}`, { name: 'QA Folder Updated' }, auth());
  });

  await run('Patch Folder', async () => {
    await axios.patch(`${BASE}/folders/${folderId}`, { emoji: '✏️' }, auth());
  });

  await run('Duplicate Folder', async () => {
    await axios.post(`${BASE}/folders/${folderId}/duplicate`, {}, auth());
  });

  await run('Sync Folders (offline batch)', async () => {
    await axios.put(`${BASE}/folders/sync`, [
      { id: folderId, name: 'QA Synced Folder', operation: 'UPDATE' },
    ], auth());
  });

  console.log('\n── Highlight Flows ──────────────────────');
  let highlightId: string = '';

  await run('Create Highlight', async () => {
    const res = await axios.post(`${BASE}/highlights`, {
      text: 'This is a QA test highlight for automated testing.',
      url: 'https://example.com/article',
      folderId,
      source: 'web',
    }, auth());
    highlightId = res.data.id;
    if (!highlightId) throw new Error('No highlight ID returned');
  });

  await run('Get All Highlights', async () => {
    const res = await axios.get(`${BASE}/highlights`, auth());
    if (!Array.isArray(res.data)) throw new Error('Expected array of highlights');
  });

  await run('Update Highlight', async () => {
    await axios.put(`${BASE}/highlights/${highlightId}`, { text: 'Updated QA highlight text' }, auth());
  });

  await run('Pin Highlight', async () => {
    await axios.patch(`${BASE}/highlights/${highlightId}`, { pinned: true }, auth());
  });

  await run('Favourite Highlight', async () => {
    await axios.patch(`${BASE}/highlights/${highlightId}`, { favourite: true }, auth());
  });

  await run('Archive Highlight', async () => {
    await axios.patch(`${BASE}/highlights/${highlightId}`, { archived: true }, auth());
  });

  await run('Move Highlight to Child Folder', async () => {
    await axios.patch(`${BASE}/highlights/${highlightId}`, { folderId: childFolderId }, auth());
  });

  await run('Sync Highlights (offline batch)', async () => {
    await axios.put(`${BASE}/highlights/sync`, [
      { id: highlightId, text: 'Synced QA highlight', operation: 'UPDATE' },
    ], auth());
  });

  console.log('\n── Tag Flows ────────────────────────────');
  let tagId: string = '';

  await run('Create Tag', async () => {
    const res = await axios.post(`${BASE}/tags`, { name: 'qa-tag', color: '#ff0000' }, auth());
    tagId = res.data.id;
    if (!tagId) throw new Error('No tag ID returned');
  });

  await run('Get All Tags', async () => {
    const res = await axios.get(`${BASE}/tags`, auth());
    if (!Array.isArray(res.data)) throw new Error('Expected array of tags');
  });

  await run('Update Tag', async () => {
    await axios.patch(`${BASE}/tags/${tagId}`, { name: 'qa-tag-updated', color: '#00ff00' }, auth());
  });

  await run('Sync Tags (offline batch)', async () => {
    await axios.put(`${BASE}/tags/sync`, [
      { id: tagId, name: 'qa-tag-synced', operation: 'UPDATE' },
    ], auth());
  });

  console.log('\n── Comment Flows ────────────────────────');
  let commentId: string = '';

  await run('Add Comment to Highlight', async () => {
    const res = await axios.post(`${BASE}/comments`, {
      highlightId,
      text: 'QA Bot automated comment',
    }, auth());
    commentId = res.data.id;
  });

  await run('Get Comments for Highlight', async () => {
    await axios.get(`${BASE}/comments?highlightId=${highlightId}`, auth());
  });

  await run('Delete Comment', async () => {
    await axios.delete(`${BASE}/comments/${commentId}`, auth());
  });

  console.log('\n── Sharing Flows ────────────────────────');
  let shareHash: string = '';

  await run('Share Folder (create share link)', async () => {
    const res = await axios.post(`${BASE}/shares`, { resourceId: folderId, resourceType: 'FOLDER' }, auth());
    shareHash = res.data.hash;
    if (!shareHash) throw new Error('No share hash returned');
  });

  await run('Resolve Share Hash (public)', async () => {
    await axios.get(`${BASE}/shares/${shareHash}`);
  });

  await run('Log Share View', async () => {
    await axios.post(`${BASE}/shares/${shareHash}/view`, {});
  });

  await run('Clone Shared Resource', async () => {
    await axios.post(`${BASE}/shares/${shareHash}/clone`, {}, auth());
  });

  await run('Get Shared-With-Me', async () => {
    await axios.get(`${BASE}/shares/shared-with-me`, auth());
  });

  console.log('\n── Permission Flows ─────────────────────');
  await run('Get Resource Permissions', async () => {
    await axios.get(`${BASE}/permissions/${folderId}`, auth());
  });

  await run('Check Own Access Level', async () => {
    await axios.get(`${BASE}/permissions/access-level?resourceId=${folderId}`, auth());
  });

  console.log('\n── Notification Flows ───────────────────');
  await run('Get Notifications', async () => {
    await axios.get(`${BASE}/notifications`, auth());
  });

  await run('Get Unread Count', async () => {
    const res = await axios.get(`${BASE}/notifications/unread-count`, auth());
    if (typeof res.data.count === 'undefined' && typeof res.data !== 'number') {
      throw new Error('Unread count not returned');
    }
  });

  await run('Mark All Notifications Read', async () => {
    await axios.put(`${BASE}/notifications/read-all`, {}, auth());
  });

  console.log('\n── AI Feature Flows (Pro) ───────────────');
  await run('AI: Auto-Draft', async () => {
    const res = await axios.post(`${BASE}/ai/auto-draft`, { folderId }, auth());
    if (!res.data) throw new Error('No AI response returned');
  });

  await run('AI: Devils Advocate', async () => {
    const res = await axios.post(`${BASE}/ai/devils-advocate`, {
      text: 'TypeScript is the best language for all projects.',
    }, auth());
    if (!res.data) throw new Error('No AI response returned');
  });

  await run('AI: Connect the Dots', async () => {
    const res = await axios.post(`${BASE}/ai/connect-dots`, { highlightId }, auth());
    if (!res.data) throw new Error('No AI response returned');
  });

  await run('AI: Suggest Actions', async () => {
    const res = await axios.post(`${BASE}/ai/suggest-actions`, {
      text: 'We should migrate the database to a distributed architecture.',
    }, auth());
    if (!res.data) throw new Error('No AI response returned');
  });

  console.log('\n── Export Flows ─────────────────────────');
  await run('Export as Markdown', async () => {
    await axios.get(`${BASE}/export?resourceId=${folderId}&format=md`, auth());
  });

  await run('Export as PDF', async () => {
    await axios.get(`${BASE}/export?resourceId=${folderId}&format=pdf`, auth());
  });

  await run('Export as CSV', async () => {
    await axios.get(`${BASE}/export?resourceId=${folderId}&format=csv`, auth());
  });

  console.log('\n── Edge Case Flows ──────────────────────');
  await run('Access resource with no auth (should 401)', async () => {
    try {
      await axios.get(`${BASE}/folders`);
      throw new Error('Should have returned 401 but did not');
    } catch (e: any) {
      if (e?.response?.status === 401) return; // expected
      throw e;
    }
  });

  await run('Access non-existent folder (should 404)', async () => {
    try {
      await axios.get(`${BASE}/folders/non-existent-id-00000`, auth());
      throw new Error('Should have returned 404 but did not');
    } catch (e: any) {
      if (e?.response?.status === 404) return; // expected
      throw e;
    }
  });

  await run('Create highlight with empty text (should 400)', async () => {
    try {
      await axios.post(`${BASE}/highlights`, { text: '', url: 'https://example.com', folderId }, auth());
      throw new Error('Should have returned 400 but did not');
    } catch (e: any) {
      if (e?.response?.status === 400) return; // expected
      throw e;
    }
  });

  console.log('\n── Cleanup ──────────────────────────────');
  await run('Delete Tag', async () => {
    await axios.delete(`${BASE}/tags/${tagId}`, auth());
  });

  await run('Delete Highlight', async () => {
    await axios.delete(`${BASE}/highlights/${highlightId}`, auth());
  });

  await run('Delete Child Folder', async () => {
    await axios.delete(`${BASE}/folders/${childFolderId}`, auth());
  });

  await run('Delete Root Folder', async () => {
    await axios.delete(`${BASE}/folders/${folderId}`, auth());
  });

  return results;
}
