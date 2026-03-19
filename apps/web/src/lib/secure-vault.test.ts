import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shredClientVault, clearVaultKey } from './secure-vault';
import { del as idbDel } from 'idb-keyval';

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

describe('secure-vault', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window and sessionStorage
    Object.defineProperty(global, 'window', {
      value: {
        sessionStorage: {
          getItem: vi.fn(),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
      },
      writable: true,
    });
  });

  describe('clearVaultKey', () => {
    it('clears session storage', () => {
      clearVaultKey();
      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('cortex:vault:session-key');
    });
  });

  describe('shredClientVault', () => {
    it('deletes specific keys from IndexedDB and clears vault key', async () => {
      await shredClientVault();

      expect(idbDel).toHaveBeenCalledWith('cortex:dashboard');
      expect(idbDel).toHaveBeenCalledWith('cortex:sync-queue');
      expect(idbDel).toHaveBeenCalledWith('cortex:vault:key');
      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('cortex:vault:session-key');
    });
  });
});
