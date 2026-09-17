"use client";

import React from "react";
import Image from "next/image";
import { Sparkles, MapPin, CheckCircle2 } from "lucide-react";
import { StoreInfo } from "@/types/printJob";

interface StoreHeaderProps {
  store: StoreInfo | null;
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export const StoreHeader: React.FC<StoreHeaderProps> = ({
  store,
  currentStep,
  onStepClick,
}) => {
  const steps = [
    { num: 1, label: "Start" },
    { num: 2, label: "Upload" },
    { num: 3, label: "Settings" },
    { num: 4, label: "Preview" },
    { num: 5, label: "Payment" },
    { num: 6, label: "Track" },
  ];

  return (
    <header className="w-full bg-white/75 backdrop-blur-xl border-b border-white/80 sticky top-0 z-30 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-300">
      <div className="max-w-md mx-auto px-4 py-2.5">
        {/* Top Store Info Bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Official Animated Print Infinity Logo */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-md shadow-indigo-500/15 bg-black border border-white/40 flex items-center justify-center group-hover:scale-105 transition-transform">
                <img
                  src={store?.logo_url || "/logo.png"}
                  alt={`${store?.name || "Print Infinity"} Logo`}
                  className="w-full h-full object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" aria-hidden="true"></span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-extrabold text-slate-900 tracking-tight truncate">
                  {store?.name || "Print Infinity"}
                </h1>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Ready
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span>{store?.address || "In-Store Terminal"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50/80 border border-indigo-100/80 text-indigo-700 text-xs font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Instant</span>
          </div>
        </div>

        {/* 6-Step Progress Pills (Mobile Optimized) */}
        {currentStep > 1 && (
          <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between">
            {steps.map((step, idx) => {
              const isPassed = currentStep > step.num;
              const isCurrent = currentStep === step.num;
              const canClick = isPassed && onStepClick && currentStep < 6;

              return (
                <div key={step.num} className="flex items-center flex-1 last:flex-initial">
                  <button
                    type="button"
                    disabled={!canClick}
                    onClick={() => canClick && onStepClick(step.num)}
                    aria-label={`Step ${step.num}: ${step.label}${isCurrent ? " (Current)" : isPassed ? " (Completed)" : ""}`}
                    className={`min-h-[44px] flex items-center gap-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-lg px-1 ${
                      isCurrent
                        ? "text-indigo-600 font-bold"
                        : isPassed
                        ? "text-slate-700 hover:text-indigo-600"
                        : "text-slate-400"
                    } ${canClick ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                        isCurrent
                          ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200"
                          : isPassed
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {isPassed ? <CheckCircle2 className="w-3 h-3" /> : step.num}
                    </span>
                    <span className="hidden sm:inline text-[10px]">{step.label}</span>
                  </button>

                  {idx < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-1 rounded-full transition-colors ${
                        currentStep > step.num ? "bg-emerald-400" : "bg-slate-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
};
