import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { useAuthStore } from '../store/authStore';

// Mock the dashboard store
vi.mock('@/store/dashboard', () => ({
  useDashboardStore: {
    getState: () => ({
      resetStore: vi.fn(),
    }),
  },
}));

// Save the original location
const originalLocation = window.location;

describe('useAuthStore', () => {
  const initialState = useAuthStore.getState();

  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState(initialState, true);

    // Reset global fetch mock
    global.fetch = vi.fn() as Mock;

    // Reset window.location
    delete (window as any).location;
    window.location = { ...originalLocation, pathname: '/', search: '', href: '' };

    vi.clearAllMocks();
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('fetchUser - normal success case', async () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      fullName: 'Test User',
      avatarUrl: null,
      tier: 'FREE',
      createdAt: '2023-01-01',
    };

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authenticated: true, user: mockUser }),
    });

    // Start fetchUser
    const fetchPromise = useAuthStore.getState().fetchUser();

    // Verify loading state is true while fetching
    expect(useAuthStore.getState().isLoading).toBe(true);

    await fetchPromise;

    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.hasFetched).toBe(true);
    expect(state.user).toEqual(mockUser);
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/me', { credentials: 'include' });
  });

  it('fetchUser - API returns unauthenticated', async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authenticated: false }),
    });

    await useAuthStore.getState().fetchUser();

    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.hasFetched).toBe(true);
    expect(state.user).toBeNull();
  });

  it('fetchUser - 401 unauthenticated redirect logic', async () => {
    // Current path is something that needs auth
    window.location.pathname = '/dashboard';
    window.location.search = '?q=test';

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    await useAuthStore.getState().fetchUser();

    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.hasFetched).toBe(true);
    expect(state.user).toBeNull();

    // Expect window location to be redirected
    expect(window.location.href).toBe('/login?returnTo=%2Fdashboard%3Fq%3Dtest');
  });

  it('fetchUser - 401 unauthenticated no redirect on /login', async () => {
    window.location.pathname = '/login';

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    await useAuthStore.getState().fetchUser();

    // No redirect should happen
    expect(window.location.href).toBe('');
  });

  it('fetchUser - 401 unauthenticated no redirect on /signup', async () => {
    window.location.pathname = '/signup';

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    await useAuthStore.getState().fetchUser();

    // No redirect should happen
    expect(window.location.href).toBe('');
  });

  it('fetchUser - fetch error (e.g. network failure)', async () => {
    (global.fetch as Mock).mockRejectedValueOnce(new Error('Network error'));

    await useAuthStore.getState().fetchUser();

    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.hasFetched).toBe(true);
    expect(state.user).toBeNull();
  });

  it('fetchUser - prevents concurrent fetches', async () => {
    // Set isLoading to true directly
    useAuthStore.setState({ isLoading: true });

    await useAuthStore.getState().fetchUser();

    // fetch should not have been called
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetchUser - prevents duplicate fetches if already fetched', async () => {
    // Set hasFetched to true directly
    useAuthStore.setState({ hasFetched: true });

    await useAuthStore.getState().fetchUser();

    // fetch should not have been called
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
