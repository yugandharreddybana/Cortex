"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Confetti } from "@/components/ui/Confetti"; // Assuming a confetti component exists or we can mock it
import { cn } from "@cortex/ui";

const ease = [0.16, 1, 0.3, 1];

export default function SubscriptionSuccessPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6 overflow-hidden relative">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/20 blur-[120px] rounded-full -z-10" />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease }}
        className={cn(
          "max-w-md w-full bg-surface/40 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-10 text-center",
          "shadow-[0_24px_80px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]"
        )}
      >
        {/* Success Icon Animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.3 }}
          className="w-20 h-20 bg-accent rounded-full mx-auto mb-8 flex items-center justify-center shadow-[0_0_40px_rgba(108,99,255,0.4)]"
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </motion.div>

        <h1 className="text-3xl font-bold tracking-tight text-white mb-3">
          Welcome to Premium!
        </h1>
        <p className="text-white/50 mb-10 leading-relaxed">
          Your account has been successfully upgraded. You now have unlimited access to all Pro features.
        </p>

        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="flex items-center justify-center w-full h-12 bg-white text-black font-semibold rounded-2xl transition-transform active:scale-95 hover:bg-white/90"
          >
            Go to Dashboard
          </Link>
          <p className="text-[11px] text-white/20">
            A confirmation email has been sent to your inbox.
          </p>
        </div>
      </motion.div>

      {/* Decorative Floating Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
         {[...Array(6)].map((_, i) => (
           <motion.div
             key={i}
             initial={{ 
               opacity: 0,
               x: Math.random() * 100 - 50 + "%",
               y: "100%" 
             }}
             animate={{ 
               opacity: [0, 1, 0],
               y: "-20%" 
             }}
             transition={{ 
               duration: 5 + Math.random() * 5, 
               repeat: Infinity, 
               delay: i * 2,
               ease: "linear"
             }}
             className="absolute w-1 h-1 bg-accent/40 rounded-full"
           />
         ))}
      </div>
    </div>
  );
}
