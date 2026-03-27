"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, useScroll, useSpring } from "framer-motion";
import { HighlightsMasonry } from "@/components/dashboard/HighlightsMasonry";
import { useDashboardStore } from "@/store/dashboard";
import { TagEditDialog } from "@/components/dashboard/TagEditDialog";
import { cn } from "@cortex/ui";
import { 
  ArrowLeft, 
  Tag as TagIcon, 
  Trash2, 
  Pencil, 
  Calendar, 
  Hash, 
  Layers,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";

export default function TagDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const tags = useDashboardStore((s) => s.tags);
  const tag = tags.find((t) => t.id === id);
  const highlights = useDashboardStore((s) => s.highlights);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const deleteTag = useDashboardStore((s) => s.deleteTag);

  const [editOpen, setEditOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Layout Scroll Progress - Callback Ref pattern for definitive hydration
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ container: container ? { current: container } : undefined });
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });

  const associatedHighlights = React.useMemo(() => 
    highlights.filter(h => h.tags?.includes(id)), 
  [highlights, id]);

  const handleDelete = async () => {
    if (!tag) return;
    if (!confirm(`Are you sure you want to delete the tag "${tag.name}"? This will remove it from all highlights.`)) return;
    
    setIsDeleting(true);
    const toastId = toast.loading(`Deleting tag "${tag.name}"...`);
    try {
      await deleteTag(tag.id);
      toast.success(`Tag "${tag.name}" deleted`, { id: toastId });
      router.push("/dashboard");
    } catch (err) {
      toast.error("Failed to delete tag", { id: toastId });
      setIsDeleting(false);
    }
  };

  if (!tag && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-6">
          <TagIcon className="w-8 h-8 text-white/20" />
        </div>
        <h1 className="text-xl font-semibold text-white/90 mb-2">Tag not found</h1>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-4 text-sm text-accent hover:underline"
        >
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const formattedDate = tag?.createdAt 
    ? new Date(tag.createdAt).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : "Recently";

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Scroll progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-0.5 bg-accent z-50 origin-left"
        style={{ scaleX }}
      />

      {/* Sticky Header - Mirroring Reading Mode */}
      <header className="sticky top-0 z-40 shrink-0 h-14 flex items-center justify-between px-6 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/[0.06] hover:bg-white/[0.06]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          
          <div className="h-4 w-px bg-white/10 hidden md:block" />
          
          <div className="hidden md:flex items-center gap-2">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: tag?.color }} 
            />
            <span className="text-xs font-medium text-white/60 truncate max-w-[200px]">
              {tag?.name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditOpen(true)}
            className="h-9 px-4 rounded-lg flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.08] transition-all text-xs font-medium"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="h-9 w-9 rounded-lg flex items-center justify-center bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div 
        ref={setContainer}
        className="flex-1 overflow-y-auto"
      >
        <div className="max-w-[1400px] mx-auto w-full flex flex-col lg:flex-row min-h-full">
          
          {/* Left Column: Highlights Masonry */}
          <main className="flex-1 p-8 lg:p-12 border-r border-white/[0.06]">
            <div className="mb-10">
              <div className="flex items-center gap-2 text-xs font-medium text-accent mb-3 uppercase tracking-widest opacity-80">
                <Layers className="w-3.5 h-3.5" />
                Collection
              </div>
              <h2 className="text-2xl font-bold text-white/90">
                Found {associatedHighlights.length} highlights
              </h2>
            </div>

            <HighlightsMasonry filterFn={(h) => h.tags?.includes(id) ?? false} />
          </main>

          {/* Right Column: Metadata Sidebar */}
          <aside className="w-full lg:w-80 p-8 lg:p-10 bg-[#0c0c0c]/50">
            <div className="sticky top-10 space-y-10">
              
              {/* Tag Identity */}
              <section>
                <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-6">
                  Tag Identity
                </h3>
                <div className="space-y-6">
                  <div className="flex items-center gap-4 group">
                    <div 
                      className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-transform group-hover:scale-105"
                      style={{ 
                        backgroundColor: `${tag?.color}15`,
                        color: tag?.color,
                        border: `1px solid ${tag?.color}30`
                      }}
                    >
                      <TagIcon className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-white/90 leading-tight">
                        {tag?.name}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-white/40">
                        <Hash className="w-3 h-3" />
                        <span className="font-mono">{tag?.color.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Statistics & Info */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-6">
                  Information
                </h3>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-2.5 text-xs text-white/50">
                      <Calendar className="w-3.5 h-3.5" />
                      Created
                    </div>
                    <span className="text-xs font-medium text-white/80">{formattedDate}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-2.5 text-xs text-white/50">
                      <Layers className="w-3.5 h-3.5" />
                      Usage
                    </div>
                    <span className="text-xs font-medium text-white/80">
                      {associatedHighlights.length} highlights
                    </span>
                  </div>
                </div>
              </section>

              {/* Quick Actions */}
              <section>
                <div className="p-4 rounded-2xl bg-accent/5 border border-accent/10 relative overflow-hidden group">
                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-accent/10 blur-2xl rounded-full" />
                  <h4 className="text-xs font-semibold text-accent mb-1 relative z-10">Quick Tip</h4>
                  <p className="text-[11px] text-white/40 leading-relaxed relative z-10">
                    Edits to this tag will propagate instantly to all {associatedHighlights.length} associated highlights across your workspace.
                  </p>
                </div>
              </section>
            </div>
          </aside>

        </div>
      </div>

      {tag && (
        <TagEditDialog 
          tag={tag} 
          open={editOpen} 
          onOpenChange={setEditOpen} 
        />
      )}
    </div>
  );
}
