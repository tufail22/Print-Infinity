"use client";

import React, { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import {
  CheckCircle2,
  Clock,
  Printer,
  Sparkles,
  AlertCircle,
  FileText,
  RotateCcw,
  ShieldCheck,
  Check,
} from "lucide-react";
import { JobStatus, PrintJobRecord } from "@/types/printJob";
import { getCustomerSupabaseClient } from "@/lib/supabaseClient";

interface LiveTrackerProps {
  job: PrintJobRecord;
  customerToken: string;
  onNewJob: () => void;
}

export const LiveTracker: React.FC<LiveTrackerProps> = ({
  job: initialJob,
  customerToken,
  onNewJob,
}) => {
  const [job, setJob] = useState<PrintJobRecord>(initialJob);
  const [hasCelebrated, setHasCelebrated] = useState(false);

  // Subscribe to Realtime Postgres changes on print_jobs for this job
  useEffect(() => {
    const supabase = getCustomerSupabaseClient();

    // Listen to changes on the print_jobs table for this job
    const channel = supabase
      .channel(`job_tracker_${job.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "print_jobs",
          filter: `id=eq.${job.id}`,
        },
        (payload) => {
          console.log("[LiveTracker] Realtime update received:", payload);
          if (payload.new) {
            setJob((prev) => ({ ...prev, ...(payload.new as PrintJobRecord) }));
          }
        }
      )
      .subscribe((status) => {
        console.log("[LiveTracker] Subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [job.id]);

  // Celebrate on completion
  useEffect(() => {
    if (job.status === "completed" && !hasCelebrated) {
      setHasCelebrated(true);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [job.status, hasCelebrated]);

  const stages: { key: JobStatus; title: string; desc: string }[] = [
    {
      key: "pending_approval",
      title: "Pending Approval",
      desc: "Storekeeper reviewing request on Windows App",
    },
    {
      key: "approved",
      title: "Approved by Storekeeper",
      desc: "Directing stream into printer memory",
    },
    {
      key: "printing",
      title: "Printing Document",
      desc: "Hardware printer actively processing sheets",
    },
    {
      key: "completed",
      title: "Ready for Pickup",
      desc: "Collect your freshly printed pages at the counter",
    },
  ];

  const getStageIndex = (status: JobStatus): number => {
    switch (status) {
      case "pending_payment":
        return 0;
      case "pending_approval":
        return 0;
      case "approved":
        return 1;
      case "printing":
        return 2;
      case "completed":
        return 3;
      default:
        return 0;
    }
  };

  const currentIndex = getStageIndex(job.status);
  const isRejected = job.status === "rejected";
  const isExpired = job.status === "expired";

  return (
    <div className="w-full space-y-5 pb-8 animate-fadeIn">
      {/* Top Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-spin" style={{ animationDuration: "5s" }} />
          <span>Live Store Realtime Tracking</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Request Submitted!
        </h2>
        <p className="text-xs text-slate-500">
          Order Ticket: <span className="font-mono font-bold text-slate-700">{job.id.slice(0, 8).toUpperCase()}</span>
        </p>
      </div>

      {/* Rejection / Expired Alert */}
      {isRejected && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
          <div className="flex items-center gap-2 font-bold text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Job Rejected by Storekeeper</span>
          </div>
          <p className="text-xs text-rose-700">
            Reason: {job.rejection_reason || "Document could not be processed at this time. Please speak to the storekeeper."}
          </p>
        </div>
      )}

      {isExpired && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 space-y-1">
          <div className="flex items-center gap-2 font-bold text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Job Session Expired</span>
          </div>
          <p className="text-xs text-amber-700">
            Files in memory have been wiped in accordance with zero-disk privacy policy.
          </p>
        </div>
      )}

      {/* Progress Timeline Card */}
      {!isRejected && !isExpired && (
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-md space-y-4">
          <div className="space-y-4">
            {stages.map((stage, idx) => {
              const isPassed = currentIndex > idx;
              const isCurrent = currentIndex === idx;

              return (
                <div key={stage.key} className="flex items-start gap-3 relative">
                  {/* Vertical connector line */}
                  {idx < stages.length - 1 && (
                    <div
                      className={`absolute left-3.5 top-8 w-0.5 h-10 -ml-[1px] transition-colors ${
                        currentIndex > idx ? "bg-emerald-500" : "bg-slate-200"
                      }`}
                    />
                  )}

                  {/* Circle Icon */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all z-10 ${
                      isPassed
                        ? "bg-emerald-500 text-white shadow-sm"
                        : isCurrent
                        ? "bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-md animate-pulse"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {isPassed ? (
                      <Check className="w-4 h-4" />
                    ) : isCurrent ? (
                      <Printer className="w-3.5 h-3.5" />
                    ) : (
                      idx + 1
                    )}
                  </div>

                  {/* Stage Info */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-xs font-bold ${
                          isCurrent
                            ? "text-indigo-600 text-sm"
                            : isPassed
                            ? "text-slate-800"
                            : "text-slate-400"
                        }`}
                      >
                        {stage.title}
                      </p>
                      {isCurrent && (
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full animate-pulse">
                          In Progress
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{stage.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ticket Details Summary */}
      <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <span>Job Details</span>
          <span className="font-mono text-[11px] text-slate-500">
            Token: {customerToken.slice(0, 8)}...
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
            <span className="text-[10px] text-slate-400 block">Color Mode</span>
            <span className="font-bold text-slate-800 capitalize">
              {job.color_mode === "bw" ? "Black & White" : "Full Color"}
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
            <span className="text-[10px] text-slate-400 block">Copies &amp; Paper</span>
            <span className="font-bold text-slate-800">
              {job.copies} × {job.paper_size} {job.duplex ? "(2-Sided)" : ""}
            </span>
          </div>
        </div>

        {/* Privacy badge */}
        <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/60 flex items-center gap-2 text-[11px] text-emerald-800 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Zero-disk privacy active: In-memory streaming to hardware printer.</span>
        </div>
      </div>

      {/* Action Button: Print Another */}
      <button
        type="button"
        onClick={onNewJob}
        className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs shadow-sm active:scale-98 transition-all flex items-center justify-center gap-2"
      >
        <RotateCcw className="w-4 h-4 text-slate-500" />
        <span>Print Another Document</span>
      </button>
    </div>
  );
};
