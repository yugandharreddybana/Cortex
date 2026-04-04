import { StateCreator } from "zustand";
import { DashboardState } from "../types";
import { apiFetch } from "../helpers";

export interface AccessRequestSlice {
  pendingAccessRequests: Record<string, boolean>;
  checkAccessRequestStatus: (folderId: string) => Promise<boolean>;
  requestAccess: (folderId: string, role: string) => Promise<{ ok: boolean; status: number }>;
  respondToAccessRequest: (requestId: string, action: "APPROVE" | "REJECT") => Promise<boolean>;
}

const IN_FLIGHT_STATUS_CHECKS = new Map<string, Promise<boolean>>();

export const createAccessRequestSlice: StateCreator<DashboardState, [], [], AccessRequestSlice> = (set, get) => ({
  pendingAccessRequests: {},

  checkAccessRequestStatus: async (folderId) => {
    const cached = get().pendingAccessRequests[folderId];
    if (cached !== undefined) return cached;

    const inFlight = IN_FLIGHT_STATUS_CHECKS.get(folderId);
    if (inFlight) return inFlight;

    const promise = (async () => {
      try {
        const { ok, data } = await apiFetch<{ hasPendingRequest: boolean }>(
          `/api/folders/${encodeURIComponent(folderId)}/access-request-status`
        );
        const hasPending = ok && data?.hasPendingRequest === true;

        set((s) => ({
          pendingAccessRequests: { ...s.pendingAccessRequests, [folderId]: hasPending },
        }));

        return hasPending;
      } finally {
        IN_FLIGHT_STATUS_CHECKS.delete(folderId);
      }
    })();

    IN_FLIGHT_STATUS_CHECKS.set(folderId, promise);
    return promise;
  },

  requestAccess: async (folderId, role) => {
    get().setGlobalLoading(true);
    try {
      const res = await apiFetch<unknown>(`/api/folders/${encodeURIComponent(folderId)}/request-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (res.ok || res.status === 409) {
        set((s) => ({
          pendingAccessRequests: { ...s.pendingAccessRequests, [folderId]: true },
        }));
      }

      return { ok: res.ok, status: res.status };
    } finally {
      get().setGlobalLoading(false);
    }
  },

  respondToAccessRequest: async (requestId, action) => {
    const { ok } = await apiFetch<unknown>(`/api/access-requests/${encodeURIComponent(requestId)}/respond?action=${action}`, {
      method: "PUT",
    });
    return ok;
  },
});
