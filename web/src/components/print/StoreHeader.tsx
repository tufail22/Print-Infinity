"use client";

import React from "react";
import { Printer, Sparkles, MapPin, CheckCircle2 } from "lucide-react";
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
    { num: 4, label: "Payment" },
    { num: 5, label: "Status" },
  ];

  return (
    <header className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 transition-all duration-300">
      <div className="max-w-md mx-auto px-4 py-3">
        {/* Top Store Info Bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Animated Store Logo */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white animate-pulse">
                <Printer className="w-5 h-5" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold text-slate-900 truncate">
                  {store ? store.name : "Print Infinity Station"}
                </h1>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Ready
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                {store?.address || "In-Store Cloud Terminal"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl text-slate-600 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" style={{ animationDuration: "6s" }} />
            <span>Fast Print</span>
          </div>
        </div>

        {/* Step Indicator Bar (Visible on mobile) */}
        {currentStep > 1 && (
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
            {steps.map((step, idx) => {
              const isPassed = currentStep > step.num;
              const isCurrent = currentStep === step.num;
              const canClick = isPassed && onStepClick && currentStep < 5;

              return (
                <div key={step.num} className="flex items-center flex-1 last:flex-initial">
                  <button
                    type="button"
                    disabled={!canClick}
                    onClick={() => canClick && onStepClick(step.num)}
                    className={`flex items-center gap-1.5 text-xs font-medium transition-all ${
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
                    <span className="hidden sm:inline text-[11px]">{step.label}</span>
                  </button>

                  {idx < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-1.5 rounded-full transition-colors ${
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
