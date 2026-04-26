export type SortOrder = "recent" | "oldest" | "site";

export interface Folder {
  id:       string;
  name:     string;
  emoji:    string;
  count:    number;
  parentId?: string;
  isPinned?: boolean;
  linkAccess?: string;
  defaultLinkRole?: string;
  effectiveRole?: string;
  ownerId?:       string;
  createdAt?: string;
  updatedAt?: string;
  synthesis?: string;
}

export interface SmartCollection {
  id:       string;
  name:     string;
  tagIds:   string[];
}

export interface Tag {
  id:    string;
  name:  string;
  color: string;
  createdAt?: string;
}

// ── NEW: metadata stored with AI-agent bookmarks ─────────────────────────────
export interface HighlightMeta {
  /** Matches the data-message-id attribute on the rendered message block */
  messageId: string;
  /** Character offset into the first matching text node */
  startOffset: number;
  endOffset: number;
  /** First 80 chars of the selection — used as fuzzy fallback if offsets drift */
  quote: string;
  /** Optional: which conversation this bookmark lives in */
  conversationId?: string;
}

export interface Highlight {
  id:         string;
  text:       string;
  source:     string;
  url:        string;
  topic:      string;
  topicColor: string;
  savedAt:    string;
  folder?:    string;
  folderId?:  string;
  note?:      string;
  tags?:      Tag[];
  isCode?:    boolean;
  isFavorite: boolean;
  isArchived: boolean;
  isPinned?:  boolean;
  highlightColor?: string;
  aiContext?: string;
  aiResponse?: string;
  resourceType?: "TEXT" | "VIDEO";
  videoTimestamp?: number;
  linkAccess?: string;
  defaultLinkRole?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  highlightType?: "web" | "ai_chat" | "manual";
  connectDotsResult?: string;
  actionItemsResult?: string;
  devilsAdvocateResult?: string;
  customPrompt?: string;
  isTruncated?: boolean;
  fullText?: string;
  /** Navigation metadata — only present on highlightType === "ai_chat" bookmarks */
  meta?: HighlightMeta;
}

export interface NotificationItem {
  id:        string;
  message:   string;
  isRead:    boolean;
  actionUrl: string;
  type:      string;
  metadata:  string;
  responded: string;
  createdAt: string;
}

export interface DashboardState {
  // UI
  sidebarCollapsed: boolean;
  activeFolder:     string | null;
  sortOrder:        SortOrder;
  viewMode:            "grid" | "list";
  activeDomainFilters: string[];
  activeTagFilters:    string[];
  searchQuery:         string;
  isSearching:         boolean;
  selectedHighlightIds: string[];
  isGlobalLoading: boolean;
  loadingCount:           number;
  isLoading:              boolean;
  focusedHighlightIdx:    number;
  newFolderDialogOpen:       boolean;
  newHighlightDialogOpen:    boolean;

  // Data
  folders: Folder[];
  smartCollections: SmartCollection[];
  tags: Tag[];
  highlights: Highlight[];
  trash: Highlight[];
  apiKeys: Array<{ id: string; name: string; key: string; createdAt: string }>;
  lastCreatedApiKey: string | null;
  notifications: NotificationItem[];
  unreadNotifCount: number;
  pendingAccessRequests: Record<string, boolean>;
  lastFoldersFetchAt: number;

  // Actions
  setSidebarCollapsed: (v: boolean) => void;
  setActiveFolder:     (id: string | null) => void;
  setSortOrder:        (order: SortOrder) => void;
  toggleSidebar:       () => void;
  setViewMode:              (mode: "grid" | "list") => void;
  toggleDomainFilter:       (domain: string) => void;
  toggleTagFilter:          (tagId: string) => void;
  setSearchQuery:           (q: string) => void;
  toggleHighlightSelect:    (id: string) => void;
  selectAllHighlights:      (ids: string[]) => void;
  clearHighlightSelection:  () => void;
  setGlobalLoading: (v: boolean) => void;
  startLoading:           () => void;
  stopLoading:            () => void;
  setIsLoading:           (v: boolean) => void;
  setFocusedHighlightIdx: (n: number) => void;
  setNewFolderDialogOpen:    (v: boolean) => void;
  setNewHighlightDialogOpen: (v: boolean) => void;

  // Folder Actions
  addFolder:           (name: string, parentId?: string) => Promise<void>;
  deleteFolder:        (id: string) => void;
  unshareFolder:       (id: string) => Promise<void>;
  bulkManagePermissions: (resourceId: number, resourceType: string, updates: any[], removals: number[]) => Promise<void>;
  renameFolder:        (id: string, name: string) => void;
  moveFolder:          (id: string, newParentId: string | undefined) => void;
  setFolderEmoji:      (id: string, emoji: string) => void;
  fetchFolders: () => Promise<void>;
  invalidateFolders: () => void;
  updateFolderSynthesis: (id: string, synthesis: string) => void;

  // Tag Actions
  addTag:              (name: string, color: string) => Promise<void>;
  updateTag:           (id: string, name: string, color: string) => Promise<void>;
  deleteTag:           (id: string) => void;
  fetchTags: () => Promise<void>;
  setTagFilterExclusive: (tagIds: string[]) => void;

  // Highlight Actions
  addHighlight:        (h: Pick<Highlight, "text" | "source"> & { folderId?: string, tagIds?: string[], url?: string, meta?: HighlightMeta }) => Promise<boolean>;
  updateHighlight:     (id: string, patch: Partial<Highlight> & { tagIds?: string[] }) => Promise<void>;
  moveHighlight:       (id: string, folderId: string | null, folderName?: string) => void;
  toggleFavorite:      (id: string) => void;
  toggleArchive:       (id: string) => void;
  togglePinHighlight:  (id: string) => void;
  togglePinFolder:     (id: string) => void;
  deleteHighlight:     (id: string) => void;
  restoreHighlight:    (id: string) => Promise<void>;
  searchHighlights:    (q: string) => Promise<void>;
  fetchTrash:          () => Promise<void>;

  // Notification Actions
  fetchNotifications:      () => Promise<void>;
  pushNotification:        (n: NotificationItem) => void;
  removeNotification:      (id: string) => void;
  markNotificationRead:    (id: string) => void;
  markAllNotificationsRead: () => void;

  // Access Request Actions
  checkAccessRequestStatus: (folderId: string) => Promise<boolean>;
  requestAccess: (folderId: string, role: string) => Promise<{ ok: boolean; status: number }>;
  respondToAccessRequest: (requestId: string, action: "APPROVE" | "REJECT") => Promise<boolean>;

  // Smart Collection Actions
  addSmartCollection:    (name: string, tagIds: string[]) => void;
  deleteSmartCollection: (id: string) => void;
  fetchSmartCollections: () => Promise<void>;

  // API Key Actions
  addApiKey:    (name: string) => void;
  deleteApiKey: (id: string) => void;
  clearLastCreatedApiKey: () => void;

  // Misc
  resetStore: () => void;
}
