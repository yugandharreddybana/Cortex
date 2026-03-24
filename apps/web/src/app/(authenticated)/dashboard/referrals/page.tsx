"use client";

import { useEffect, useState } from "react";
import { CopyIcon, CheckIcon, GiftIcon, UsersIcon, AwardIcon } from "lucide-react";
import { proxyToJava } from "@/lib/proxy";

export default function ReferralsPage() {
  const [stats, setStats] = useState<{ referralCode: string; totalReferred: number; totalAccepted: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await proxyToJava("/api/v1/referrals", { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to load referral stats:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const referralLink = stats?.referralCode
    ? `${window.location.origin}/signup?ref=${stats.referralCode}`
    : "";

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 text-white/50 text-center animate-pulse mt-20">
        Loading referral data...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8 lg:p-12 space-y-8">
        <div>
          <h1 className="text-3xl font-medium text-white tracking-tight mb-2">Refer a Friend</h1>
          <p className="text-white/60">
            Invite your friends to Cortex. When they sign up and create their first 5 highlights,
            you both get a free month of Pro subscription!
          </p>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-6 lg:p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">Your Unique Referral Link</label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                readOnly
                value={referralLink}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white/90 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-white/90 transition-colors"
              >
                {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>
            <p className="text-xs text-white/40 pt-1">
              Share this link directly with friends or on social media.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <UsersIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/60 mb-1">Friends Referred</p>
              <div className="text-3xl font-semibold text-white">{stats?.totalReferred || 0}</div>
              <p className="text-xs text-white/40 mt-1">Friends who signed up with your link</p>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
              <AwardIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/60 mb-1">Rewards Earned</p>
              <div className="text-3xl font-semibold text-white">{stats?.totalAccepted || 0}</div>
              <p className="text-xs text-white/40 mt-1">Friends who completed 5 highlights</p>
            </div>
          </div>
        </div>

        <div className="bg-black/40 border border-white/[0.05] rounded-xl p-6">
          <h3 className="text-sm font-medium text-white/90 mb-4 flex items-center gap-2">
            <GiftIcon className="w-4 h-4 text-white/50" />
            How it works
          </h3>
          <ol className="list-decimal list-inside space-y-3 text-sm text-white/60">
            <li>Share your unique referral link with a friend.</li>
            <li>They click the link and sign up for a new Cortex account.</li>
            <li>They start using Cortex and create at least 5 highlights.</li>
            <li>Once their 5th highlight is created, you both automatically receive 1 month of Pro!</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
