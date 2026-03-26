"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as ContextMenu from "@radix-ui/react-context-menu";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { cn } from "@cortex/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@cortex/ui";
import { Badge } from "@cortex/ui";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";
import { useAuthStore } from "@/store/authStore";
import type { Folder, SmartCollection } from "@/store/dashboard";
import { FolderCreateDialog } from "./FolderCreateDialog";
import { DeleteAlertDialog } from "./DeleteAlertDialog";
import { DuplicateFolderModal } from "./DuplicateFolderModal";
import { NewTagDialog } from "./NewTagDialog";
import { RenameFolderDialog } from "./RenameFolderDialog";
import { ShareDialog, ShareIcon } from "./ShareDialog";
import { Loader2 } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function XTinyIcon() { return <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M1 1l6 6M7 1L1 7" /></svg>; }
function DotsHorizontalIcon() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><circle cx="3" cy="7" r="1.1" /><circle cx="7" cy="7" r="1.1" /><circle cx="11" cy="7" r="1.1" /></svg>; }
function ChevronUpDownIcon()  { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 4.5L6 2L9 4.5M3 7.5L6 10L9 7.5" /></svg>; }
function CortexMark()         { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"><circle cx="6" cy="6" r="4" /><path d="M6 4v2l1.5 1.5" /></svg>; }
function PinSmallIcon()       { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.5L13.5 6.5L10 10L9 13L3 7L6 6L9.5 2.5Z" /><path d="M3 13L6 10" /></svg>; }
function TrashNavIcon()       { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>; }

const ic = (d: string, size = 16) => <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
function GridIcon()       { return ic("M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z"); }
function StarIcon()       { return ic("M8 2l1.8 3.6L14 6.4l-3 2.9.7 4.1L8 11.4l-3.7 1.9.7-4.1L2 6.4l4.2-.8z"); }
function ArchiveIcon()    { return ic("M3 5h10M4 5v7a1 1 0 001 1h6a1 1 0 001-1V5M6 9h4"); }
function SearchIcon()     { return ic("M7 13A6 6 0 107 1a6 6 0 000 12zM13 13l2 2"); }
function PlusIcon()       { return ic("M8 3v10M3 8h10"); }
function InfoIcon()       { return ic("M8 15A7 7 0 108 1a7 7 0 000 14zM8 11V7M8 5h.01"); }
function PencilIcon()     { return ic("M11 2l3 3-8 8H3v-3l8-8z"); }
function MoveIcon()       { return ic("M3 8h10M9 5l3 3-3 3M11 12v2a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1h2"); }
function TrashIcon()      { return ic("M3 5h10M5 5V3h6v2M6 8v4M10 8v4"); }
function CopyIcon()       { return ic("M10 2H4a1 1 0 00-1 1v9a1 1 0 001 1h8a1 1 0 001-1V5l-3-3zM9 2v3h3M3 7h8"); }
function UserIcon()       { return ic("M8 7a3 3 0 100-6 3 3 0 000 6zM3 14a5 5 0 0110 0"); }
function CreditCardIcon() { return ic("M1 5h14v8a1 1 0 01-1 1H2a1 1 0 01-1-1V5zM1 9h14"); }
function GiftIcon()       { return ic("M10.833 3.5h-2.11C8.944 2.392 8.01 1.5 6.833 1.5c-1.178 0-2.11.892-2.335 2H2.5A1.5 1.5 0 0 0 1 5v2c0 .828.672 1.5 1.5 1.5h8.333c.828 0 1.5-.672 1.5-1.5V5A1.5 1.5 0 0 0 10.833 3.5ZM6.667 3.5V8.5M10.833 8.5v4.5A1.5 1.5 0 0 1 9.333 14.5H4A1.5 1.5 0 0 1 2.5 13V8.5"); }
function LogOutIcon()     { return ic("M10 3h3a1 1 0 011 1v8a1 1 0 01-1 1h-3M7 10l3-2-3-2M1 8h9"); }

const dropdownItemCls = "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/70 cursor-pointer select-none outline-none hover:bg-white/[0.07] hover:text-white transition-colors duration-100";
function DropdownItem({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) {
  return <DropdownMenu.Item onSelect={onSelect} className={cn(dropdownItemCls)}>{children}</DropdownMenu.Item>;
}

const TAG_COLOR_MAP: any = { blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" }, violet: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" }, emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" }, amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" }, pink: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/20" }, teal: { bg: "bg-teal-500/10", text: "text-teal-400", border: "border-teal-500/20" } };
function resolveTagColor(color: string) { if (color?.startsWith("#")) return null; return TAG_COLOR_MAP[color] ?? TAG_COLOR_MAP.blue; }

// ─── Components ───────────────────────────────────────────────────────────────

function UserProfileDropdown() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const displayName = user?.fullName || user?.email?.split("@")[0] || "User";
  const displayEmail = user?.email || "";
  const initials = displayName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="p-3 border-t border-white/[0.06]">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ease-snappy hover:bg-white/[0.05]")}>
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarImage src={user?.avatarUrl || ""} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-white/90 truncate">{displayName}</p>
              <p className="text-xs text-white/35 truncate">{displayEmail}</p>
            </div>
            <ChevronUpDownIcon />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content side="top" sideOffset={6} align="start" className={cn("z-50 min-w-[220px] rounded-xl overflow-hidden bg-[#1e1e1e] border border-white/[0.09] shadow-[0_-8px_32px_rgba(0,0,0,0.4),0_16px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] p-1")}>
            <div className="px-3 py-2.5 border-b border-white/[0.07] mb-1">
              <p className="text-xs font-medium text-white/80">{displayName}</p>
              <p className="text-xs text-white/35">{displayEmail}</p>
            </div>
            <DropdownItem onSelect={() => router.push("/dashboard/settings/profile")}><UserIcon /> Profile</DropdownItem>
            <DropdownItem onSelect={() => router.push("/dashboard/settings/billing")}><CreditCardIcon /> Subscription</DropdownItem>
            <DropdownItem onSelect={() => router.push("/dashboard/referrals")}><GiftIcon /> Refer a Friend</DropdownItem>
            <DropdownMenu.Separator className="my-1 h-px bg-white/[0.07]" />
            <DropdownMenu.Item onSelect={() => { useAuthStore.getState().logout(); router.push("/"); }} className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/50 hover:bg-white/[0.05] hover:text-white/80 transition-colors duration-100")}>
              <LogOutIcon /> Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function FolderTreeMenu({ folders, onSelect, parentId, depth = 0, parentIdToExclude }: any) {
  const seen = new Set<string>();
  const items = folders.filter((f: any) => {
    if (f.id === parentIdToExclude) return false;
    if (parentId ? f.parentId !== parentId : !!f.parentId) return false;
    const sid = String(f.id); if (seen.has(sid)) return false; seen.add(sid); return true;
  });
  if (items.length === 0) return depth === 0 ? <div className="px-3 py-2 text-[11px] text-white/30">No folders available</div> : null;
  return (
    <>
      {items.map((folder: any) => {
        const children = folders.filter((f: any) => f.parentId === folder.id && f.id !== parentIdToExclude);
        if (children.length > 0) {
          return (
            <DropdownMenu.Sub key={folder.id}>
              <DropdownMenu.SubTrigger className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-lg w-full text-[12px] text-white/70 hover:text-white hover:bg-white/[0.06] cursor-pointer outline-none transition-colors duration-100 data-[state=open]:bg-white/[0.06]")} onClick={(e) => { e.preventDefault(); onSelect(folder.id); }}>
                <span className="text-sm shrink-0">{folder.emoji}</span><span className="flex-1 truncate text-left">{folder.name}</span><span className="ml-auto text-white/30 text-[10px]">▸</span>
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent sideOffset={4} className={cn("z-50 min-w-[160px] max-h-[280px] overflow-y-auto rounded-xl bg-[#1c1c1c] border border-white/[0.09] shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-1")}>
                  <DropdownMenu.Item className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-lg w-full mb-1 text-[12px] text-white/70 hover:text-white hover:bg-white/[0.06] cursor-pointer outline-none transition-colors duration-100")} onSelect={() => onSelect(folder.id)}><span className="text-white/40">↳</span> Move into &quot;{folder.name}&quot;</DropdownMenu.Item>
                  <FolderTreeMenu folders={folders} onSelect={onSelect} parentId={folder.id} depth={depth + 1} parentIdToExclude={parentIdToExclude} />
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
          );
        }
        return <DropdownMenu.Item key={folder.id} className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-lg w-full text-[12px] text-white/70 hover:text-white hover:bg-white/[0.06] cursor-pointer outline-none transition-colors duration-100")} onSelect={() => onSelect(folder.id)}><span className="text-sm shrink-0">{folder.emoji}</span><span className="flex-1 truncate text-left">{folder.name}</span></DropdownMenu.Item>;
      })}
    </>
  );
}

function FolderDropdown({ folder, onRename, onDelete, onShare, onDuplicate, onCreateSubfolder, onPin, onMove }: any) {
  const isOwner = !folder.effectiveRole || folder.effectiveRole === "OWNER";
  const isSharedFolder = !isOwner;
  const allFolders = useDashboardStore((s) => s.folders);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className={cn("opacity-0 group-hover/folder:opacity-100 focus:opacity-100 p-1.5 mr-1 rounded-lg shrink-0 text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all duration-150")} aria-label={`Options for ${folder.name}`}><DotsHorizontalIcon /></button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content sideOffset={4} align="start" className={cn("z-50 min-w-[160px] rounded-xl overflow-hidden bg-[#1e1e1e] border border-white/[0.09] shadow-[0_16px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] p-1")}>
          {(isOwner || folder.effectiveRole === "EDITOR") && <DropdownItem onSelect={onCreateSubfolder}><PlusIcon /> New Subfolder</DropdownItem>}
          {isOwner && (
            <>
              <DropdownItem onSelect={onPin}><PinSmallIcon /> {folder.isPinned ? "Unpin" : "Pin"}</DropdownItem>
              <DropdownItem onSelect={onRename}><PencilIcon /> Rename</DropdownItem>
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg w-full text-sm text-white/70 cursor-pointer select-none outline-none hover:bg-white/[0.06] focus:bg-white/[0.06] transition-colors duration-100")}>
                  <MoveIcon /> Move to… <span className="ml-auto text-white/30 text-[10px]">▸</span>
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent sideOffset={4} className={cn("z-50 min-w-[160px] max-h-[280px] overflow-y-auto rounded-xl bg-[#1c1c1c] border border-white/[0.09] shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-1")}>
                    <FolderTreeMenu folders={allFolders} onSelect={onMove} parentIdToExclude={folder.id} />
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
              <DropdownItem onSelect={onShare}><ShareIcon /> Share</DropdownItem>
            </>
          )}
          {isOwner && <DropdownItem onSelect={onDuplicate}><CopyIcon /> Duplicate</DropdownItem>}
          {isSharedFolder && <DropdownItem onSelect={onDuplicate}><CopyIcon /> Duplicate to workspace</DropdownItem>}
          {isOwner && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-white/[0.07]" />
              <DropdownMenu.Item onSelect={onDelete} className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 cursor-pointer select-none outline-none hover:bg-red-500/10 focus:bg-red-500/10 transition-colors duration-100")}><TrashIcon /> Delete</DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function RecursiveFolderNode({
  folder, depth, pathname, getChildren, folderCountMap, onRename, onDelete, onShare, onDuplicate, onCreateSubfolder, onPin, onMove, isLoading
}: any) {
  const [expanded, setExpanded] = React.useState(true);
  const children = getChildren(folder.id);
  const href = `/dashboard/folders/${folder.id}`;
  const isActive = pathname === href;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: folder.id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: folder.id });

  const mergedRef = React.useCallback((node: HTMLDivElement | null) => { setDragRef(node); setDropRef(node); }, [setDragRef, setDropRef]);

  return (
    <div ref={mergedRef} style={{ opacity: isDragging ? 0.4 : 1 }}>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div className="flex items-center group/folder relative">
            <div style={{ width: depth * 16, flexShrink: 0 }} />
            {children.length > 0 && (
              <button onClick={() => setExpanded((v) => !v)} className="w-4 h-4 flex items-center justify-center text-white/30 hover:text-white/60 shrink-0 mr-0.5 transition-colors">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}><path d="M2 1L6 4L2 7" /></svg>
              </button>
            )}
            {children.length === 0 && depth > 0 && <div className="w-4 shrink-0 mr-0.5" />}
            {depth > 0 && <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-white/[0.06] -z-1" style={{ left: (depth * 16) - 8 }} />}
            <Link
              href={href} {...attributes} {...listeners}
              className={cn(
                "flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-all duration-150 ease-snappy min-w-0",
                isActive ? "bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]" : "text-white/60 hover:bg-white/[0.05] hover:text-white",
                isOver && !isDragging && "ring-1 ring-accent/50 bg-accent/[0.08]",
              )}
            >
              <span className="text-base leading-none shrink-0">{folder.emoji}</span>
              <span className="flex-1 truncate text-left">{folder.name}</span>
              <span className="bg-white/10 text-white/60 text-[10px] px-1.5 rounded-full tabular-nums leading-4 shrink-0 min-w-[20px] flex items-center justify-center">
                {isLoading ? "…" : (folderCountMap[folder.id] || 0)}
              </span>
            </Link>
            <FolderDropdown folder={folder} onRename={() => onRename(folder)} onDelete={() => onDelete(folder)} onShare={() => onShare(folder)} onDuplicate={() => onDuplicate(folder)} onCreateSubfolder={() => onCreateSubfolder(folder.id)} onPin={() => onPin(folder)} onMove={(targetId: string) => onMove(folder, targetId)} />
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className={cn("z-50 min-w-[180px] rounded-xl overflow-hidden bg-[#1e1e1e] border border-white/[0.09] shadow-[0_16px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] p-1")}>
            {(!folder.effectiveRole || folder.effectiveRole === "OWNER" || folder.effectiveRole === "EDITOR") && (
              <ContextMenu.Item onSelect={() => onCreateSubfolder(folder.id)} className={cn(dropdownItemCls)}><PlusIcon /> New Subfolder</ContextMenu.Item>
            )}
            {(!folder.effectiveRole || folder.effectiveRole === "OWNER") && (
              <>
                <ContextMenu.Item onSelect={() => onPin(folder)} className={cn(dropdownItemCls)}><PinSmallIcon /> {folder.isPinned ? "Unpin" : "Pin"}</ContextMenu.Item>
                <ContextMenu.Item onSelect={() => onRename(folder)} className={cn(dropdownItemCls)}><PencilIcon /> Rename Folder</ContextMenu.Item>
                <ContextMenu.Item onSelect={() => onShare(folder)} className={cn(dropdownItemCls)}><ShareIcon /> Share Folder</ContextMenu.Item>
              </>
            )}
            {folder.effectiveRole && folder.effectiveRole !== "OWNER" && (
              <>
                <ContextMenu.Separator className="my-1 h-px bg-white/[0.07]" />
                <ContextMenu.Item onSelect={() => onDuplicate(folder)} className={cn(dropdownItemCls)}><CopyIcon /> Duplicate to my workspace</ContextMenu.Item>
              </>
            )}
            {(!folder.effectiveRole || folder.effectiveRole === "OWNER") && (
              <>
                <ContextMenu.Separator className="my-1 h-px bg-white/[0.07]" />
                <ContextMenu.Item onSelect={() => onDelete(folder)} className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 cursor-pointer select-none outline-none hover:bg-red-500/10 focus:bg-red-500/10 transition-colors duration-100")}><TrashIcon /> Delete Folder</ContextMenu.Item>
              </>
            )}
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
      {expanded && children.length > 0 && (
        <div className="space-y-0.5">
          {children.map((child: any) => (
            <RecursiveFolderNode key={child.id} folder={child} depth={depth + 1} pathname={pathname} getChildren={getChildren} folderCountMap={folderCountMap} onRename={onRename} onDelete={onDelete} onShare={onShare} onDuplicate={onDuplicate} onCreateSubfolder={onCreateSubfolder} onPin={onPin} onMove={onMove} isLoading={isLoading} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

interface SharedWithMeItem {
  viewId: string;
  hash: string;
  resourceType: "HIGHLIGHT" | "FOLDER";
  preview?: string;
  sharedBy: string;
}

const NAV_ITEMS = [
  { href: "/dashboard",           label: "All Highlights", icon: <GridIcon /> },
  { href: "/dashboard/favorites", label: "Favorites",      icon: <StarIcon /> },
  { href: "/dashboard/archive",   label: "Archive",        icon: <ArchiveIcon /> },
  { href: "/dashboard/trash",     label: "Trash",          icon: <TrashNavIcon /> },
  { href: "/dashboard/temporal-replay", label: "Temporal Replay", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
] as const;

export function Sidebar({ onCmdK }: { onCmdK?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoading = useDashboardStore((s) => s.isLoading);

  const folders            = useDashboardStore((s) => s.folders);
  const deleteFolder       = useDashboardStore((s) => s.deleteFolder);
  const moveFolder         = useDashboardStore((s) => s.moveFolder);
  const togglePinFolder    = useDashboardStore((s) => s.togglePinFolder);
  const highlights         = useDashboardStore((s) => s.highlights);
  const tags               = useDashboardStore((s) => s.tags);
  const deleteTag          = useDashboardStore((s) => s.deleteTag);
  const smartCollections   = useDashboardStore((s) => s.smartCollections);
  const deleteSmartCollection = useDashboardStore((s) => s.deleteSmartCollection);
  const activeTagFilters   = useDashboardStore((s) => s.activeTagFilters);
  const toggleTagFilter    = useDashboardStore((s) => s.toggleTagFilter);
  const setTagFilterExclusive = useDashboardStore((s) => s.setTagFilterExclusive);

  const [folderDialogOpen, setFolderDialogOpen] = React.useState(false);
  const [subfolderParentId, setSubfolderParentId] = React.useState<string | undefined>(undefined);
  const [tagDialogOpen,    setTagDialogOpen]    = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [renameTarget, setRenameTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [shareTarget, setShareTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [duplicateTarget, setDuplicateTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [sharedWithMe, setSharedWithMe] = React.useState<SharedWithMeItem[]>([]);
  const [isLoadingShared, setIsLoadingShared] = React.useState(true);
  const [sharedExpanded, setSharedExpanded] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/share", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SharedWithMeItem[]) => setSharedWithMe(data))
      .catch(() => {})
      .finally(() => setIsLoadingShared(false));
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const pinnedFolders = React.useMemo(() => {
    const seen = new Set<string>();
    return folders.filter((f) => {
      if (!f.isPinned) return false;
      const sid = String(f.id); if (seen.has(sid)) return false; seen.add(sid); return true;
    });
  }, [folders]);

  const folderCountMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const h of highlights) {
      if (h.folderId && !h.isArchived) map[h.folderId] = (map[h.folderId] || 0) + 1;
    }
    return map;
  }, [highlights]);

  const rootFoldersList = React.useMemo(() => {
    const folderIds = new Set(folders.map((f) => String(f.id)));
    const seen = new Set<string>();
    return folders.filter((f) => {
      if (f.parentId && folderIds.has(String(f.parentId))) return false;
      const sid = String(f.id); if (seen.has(sid)) return false; seen.add(sid); return true;
    });
  }, [folders]);

  const myRootFolders = React.useMemo(() => rootFoldersList.filter(f => !f.effectiveRole || f.effectiveRole === "OWNER"), [rootFoldersList]);
  const sharedRootFolders = React.useMemo(() => rootFoldersList.filter(f => f.effectiveRole && f.effectiveRole !== "OWNER"), [rootFoldersList]);

  const getChildren = React.useCallback((parentId: string) => {
    const seen = new Set<string>();
    return folders.filter((f) => {
      if (String(f.parentId) !== String(parentId)) return false;
      const sid = String(f.id); if (seen.has(sid)) return false; seen.add(sid); return true;
    });
  }, [folders]);

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    moveFolder(String(active.id), String(over.id));
  }, [moveFolder]);

  const handleCreateSubfolder = React.useCallback((parentId: string) => {
    setSubfolderParentId(parentId);
    setFolderDialogOpen(true);
  }, []);

  return (
    <>
      <aside className="w-64 flex-shrink-0 flex flex-col h-screen bg-bg border-r border-white/[0.06]">
        <div className="flex items-center gap-2 px-4 py-4 border-b border-white/[0.06]">
          <span className="w-6 h-6 rounded-md bg-accent flex items-center justify-center flex-shrink-0 shadow-glow-sm"><CortexMark /></span>
          <span className="font-semibold text-sm tracking-tight">Cortex</span>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
          <div className="px-3 pt-4 pb-2">
            <button onClick={() => onCmdK?.()} className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-muted border border-white/[0.07] bg-white/[0.03] transition-all duration-200 ease-snappy hover:text-secondary hover:border-white/[0.12]")}>
              <SearchIcon />
              <span className="flex-1 text-left">Search...</span>
              <kbd className="text-2xs bg-white/[0.07] border border-white/10 rounded px-1 leading-4 font-mono">⌘K</kbd>
            </button>
          </div>

          <nav className="px-3 py-2 space-y-0.5" aria-label="Sidebar navigation">
            {NAV_ITEMS.map(({ href, label, icon }) => {
              const isActive = pathname === href;
              const dynamicCount = isLoading ? undefined : (href === "/dashboard" ? String(highlights.filter(h => !h.isArchived).length) : href === "/dashboard/favorites" ? String(highlights.filter(h => h.isFavorite).length) : href === "/dashboard/archive" ? String(highlights.filter(h => h.isArchived).length) : undefined);
              return (
                <Link key={href} href={href} className={cn("flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-200 ease-snappy", isActive ? "bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]" : "text-white/60 hover:bg-white/[0.05] hover:text-white")}>
                  <span className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-white" : "text-white/40")}>{icon}</span>
                  <span className="flex-1">{label}</span>
                  {dynamicCount && <span className="bg-white/10 text-white/60 text-[10px] px-1.5 rounded-full tabular-nums leading-4">{dynamicCount}</span>}
                </Link>
              );
            })}
          </nav>

          {pinnedFolders.length > 0 && (
            <div className="px-3 pt-4 pb-2 border-t border-white/[0.04]">
              <div className="flex items-center px-3 mb-2"><span className="text-2xs font-semibold uppercase tracking-widest text-muted">Pinned</span></div>
              <div className="space-y-0.5">
                {pinnedFolders.map((folder) => {
                  const href = `/dashboard/folders/${folder.id}`;
                  const isActive = pathname === href;
                  return (
                    <Link key={`pinned-${folder.id}`} href={href} className={cn("flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm transition-all duration-150 ease-snappy min-w-0", isActive ? "bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]" : "text-white/60 hover:bg-white/[0.05] hover:text-white")}>
                      <PinSmallIcon />
                      <span className="text-base leading-none shrink-0">{folder.emoji}</span>
                      <span className="flex-1 truncate text-left">{folder.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <TooltipProvider>
            <div className="mt-4">
              <div className="px-3 py-2 sticky top-0 bg-bg z-20 border-b border-white/[0.04]">
                <div className="flex items-center justify-between px-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xs font-semibold uppercase tracking-widest text-muted">Folders</span>
                    <Tooltip><TooltipTrigger asChild><button className="text-white/30 hover:text-white/70 transition-colors"><InfoIcon /></button></TooltipTrigger><TooltipContent side="right"><p>Folders you created and own.</p></TooltipContent></Tooltip>
                  </div>
                  <button
                    onClick={() => setFolderDialogOpen(true)}
                    className="p-1 rounded-md text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all duration-150"
                    aria-label="New folder"
                  ><PlusIcon /></button>
                </div>
              </div>
              <div className="px-3 pt-2 pb-6">
                <DndContext id="sidebar-folders-mine" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <div className="space-y-0.5">
                    {myRootFolders.map((folder) => (
                      <RecursiveFolderNode key={folder.id} folder={folder} depth={0} pathname={pathname} getChildren={getChildren} folderCountMap={folderCountMap} onRename={(f: any) => setRenameTarget({ id: f.id, name: f.name })} onDelete={(f: any) => setDeleteTarget({ id: f.id, name: f.name })} onShare={(f: any) => setShareTarget({ id: f.id, name: f.name })} onDuplicate={(f: any) => setDuplicateTarget({ id: f.id, name: f.name })} onCreateSubfolder={handleCreateSubfolder} onPin={(f: any) => togglePinFolder(f.id)} onMove={(f: any, targetId: string) => moveFolder(f.id, targetId)} isLoading={isLoading} />
                    ))}
                  </div>
                </DndContext>
              </div>
            </div>

            {sharedRootFolders.length > 0 && (
              <div className="mt-2">
                <div className="px-3 py-2 sticky top-0 bg-bg z-20 border-b border-white/[0.04]">
                  <div className="flex items-center gap-1.5 px-3">
                    <span className="text-2xs font-semibold uppercase tracking-widest text-muted">Shared Folders</span>
                    <Tooltip><TooltipTrigger asChild><button className="text-white/30 hover:text-white/70 transition-colors"><InfoIcon /></button></TooltipTrigger><TooltipContent side="right"><p>Folders shared with you by other users.</p></TooltipContent></Tooltip>
                  </div>
                </div>
                <div className="px-3 pt-2 pb-6">
                  <DndContext id="sidebar-folders-shared" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <div className="space-y-0.5">
                      {sharedRootFolders.map((folder) => (
                        <RecursiveFolderNode key={folder.id} folder={folder} depth={0} pathname={pathname} getChildren={getChildren} folderCountMap={folderCountMap} onRename={(f: any) => setRenameTarget({ id: f.id, name: f.name })} onDelete={(f: any) => setDeleteTarget({ id: f.id, name: f.name })} onShare={(f: any) => setShareTarget({ id: f.id, name: f.name })} onDuplicate={(f: any) => setDuplicateTarget({ id: f.id, name: f.name })} onCreateSubfolder={handleCreateSubfolder} onPin={(f: any) => togglePinFolder(f.id)} onMove={(f: any, targetId: string) => moveFolder(f.id, targetId)} isLoading={isLoading} />
                      ))}
                    </div>
                  </DndContext>
                </div>
              </div>
            )}

            {smartCollections.length > 0 && (
              <div className="mt-2">
                <div className="px-3 py-2 sticky top-0 bg-bg z-20 border-b border-white/[0.04]"><div className="px-3"><span className="text-2xs font-semibold uppercase tracking-widest text-muted">Smart Collections</span></div></div>
                <div className="px-3 pt-2 pb-6 space-y-0.5">
                  {smartCollections.map((sc) => {
                    const isActive = activeTagFilters.length === sc.tagIds.length && sc.tagIds.every(t => activeTagFilters.includes(t));
                    return (
                      <div key={sc.id} className="flex items-center group/sc">
                        <button onClick={() => setTagFilterExclusive(sc.tagIds)} className={cn("flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-all duration-150 ease-snappy min-w-0", isActive ? "bg-white/[0.09] text-white" : "text-white/60 hover:bg-white/[0.05] hover:text-white")}>
                          <span className="text-base leading-none shrink-0">⚡</span><span className="flex-1 truncate text-left">{sc.name}</span><span className="bg-white/10 text-white/60 text-[10px] px-1.5 rounded-full tabular-nums leading-4 shrink-0">{sc.tagIds.length}</span>
                        </button>
                        <button onClick={() => deleteSmartCollection(sc.id)} className="opacity-0 group-hover/sc:opacity-100 p-1.5 mr-1 rounded-lg shrink-0 text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"><XTinyIcon /></button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-2">
              <div className="px-3 py-2 sticky top-0 bg-bg z-20 border-b border-white/[0.04]">
                <div className="flex items-center justify-between px-3">
                  <span className="text-2xs font-semibold uppercase tracking-widest text-muted">Tags</span>
                  <button onClick={() => setTagDialogOpen(true)} className="p-1 rounded-md text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all duration-150" aria-label="New tag"><PlusIcon /></button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 px-6 pt-3 pb-10">
                {tags.map((tag) => {
                  const resolved = resolveTagColor(tag.color);
                  const isActive = activeTagFilters.includes(tag.id);
                  return (
                    <div key={tag.id} className="group/tag relative">
                      <span onClick={() => toggleTagFilter(tag.id)} className={cn("inline-flex items-center gap-1 border rounded-md px-2 py-1 text-xs font-medium cursor-pointer transition-all duration-150", resolved ? `${resolved.bg} ${resolved.text} border ${resolved.border}` : undefined, isActive && "ring-1 ring-accent/50 shadow-[0_0_8px_rgba(108,99,255,0.25)]")} style={{ background: tag.color.startsWith("#") ? `${tag.color}20` : `color-mix(in srgb, ${tag.color} 20%, transparent)`, color: tag.color, borderColor: tag.color.startsWith("#") ? `${tag.color}40` : `color-mix(in srgb, ${tag.color} 40%, transparent)` }}>
                        {tag.name}<button onClick={(e) => { e.stopPropagation(); deleteTag(tag.id); }} className="ml-0.5 opacity-0 group-hover/tag:opacity-60 hover:!opacity-100 transition-opacity"><XTinyIcon /></button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </TooltipProvider>

          {(sharedWithMe.length > 0 || isLoadingShared) && (
            <div className="mt-4 border-t border-white/[0.04]">
              <button onClick={() => setSharedExpanded((v) => !v)} className="flex items-center gap-1.5 px-6 py-4 w-full text-left">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-white/30" style={{ transform: sharedExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}><path d="M2 1L6 4L2 7" /></svg>
                <span className="text-2xs font-semibold uppercase tracking-widest text-muted">Shared with me</span>
                {isLoadingShared ? <Loader2 className="ml-auto w-3 h-3 animate-spin text-white/30 shrink-0" /> : <span className="ml-auto bg-white/10 text-white/50 text-[10px] px-1.5 rounded-full tabular-nums leading-4">{sharedWithMe.length}</span>}
              </button>
              {sharedExpanded && (
                <div className="px-3 pb-10 space-y-0.5">
                  {sharedWithMe.map((item) => (
                    <Link key={item.viewId} href={`/share/${item.hash}`} className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm text-white/60 hover:bg-white/[0.05] hover:text-white transition-all duration-150 ease-snappy min-w-0"><span className="text-base leading-none shrink-0">{item.resourceType === "FOLDER" ? "📂" : "💡"}</span><span className="flex-1 truncate text-left text-xs">{item.preview ?? "Shared item"}</span></Link>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="h-20" />
        </div>

        <UserProfileDropdown />
      </aside>

      <FolderCreateDialog open={folderDialogOpen} onOpenChange={(v) => { setFolderDialogOpen(v); if (!v) setSubfolderParentId(undefined); }} parentId={subfolderParentId} />
      <NewTagDialog open={tagDialogOpen} onOpenChange={setTagDialogOpen} />
      <RenameFolderDialog open={!!renameTarget} onOpenChange={(v) => !v && setRenameTarget(null)} folderId={renameTarget?.id ?? ""} currentName={renameTarget?.name ?? ""} />
      <DeleteAlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)} targetLabel={deleteTarget?.name ?? ""} targetType="folder" onConfirm={() => { if (deleteTarget) deleteFolder(deleteTarget.id); setDeleteTarget(null); }} />
      <ShareDialog open={!!shareTarget} onOpenChange={(v) => !v && setShareTarget(null)} type="f" id={shareTarget?.id ?? ""} title={shareTarget?.name ?? ""} />
      <DuplicateFolderModal open={!!duplicateTarget} onOpenChange={(v) => !v && setDuplicateTarget(null)} folderId={duplicateTarget?.id ?? ""} folderName={duplicateTarget?.name ?? ""} onSuccess={() => { setDuplicateTarget(null); useDashboardStore.getState().fetchFolders(); }} />
    </>
  );
}
