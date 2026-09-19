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
  Ticket,
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
  const [isSwitchingToCash, setIsSwitchingToCash] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Subscribe to Realtime Postgres changes on print_jobs for this job
  useEffect(() => {
    const supabase = getCustomerSupabaseClient();

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

  // Fallback Polling every 3.5s to ensure progress updates even if Realtime drops
  useEffect(() => {
    if (["completed", "rejected", "expired", "failed"].includes(job.status)) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const supabase = getCustomerSupabaseClient();
        const { data, error } = await supabase
          .from("print_jobs")
          .select("*")
          .eq("id", job.id)
          .single();

        if (data && !error) {
          setJob((prev) => {
            if (prev.status !== data.status || prev.printer_id !== data.printer_id) {
              return { ...prev, ...(data as PrintJobRecord) };
            }
            return prev;
          });
        }
      } catch {
        // quiet fallback
      }
    }, 3500);

    return () => clearInterval(intervalId);
  }, [job.id, job.status]);

  const handleSwitchToCash = async () => {
    try {
      setIsSwitchingToCash(true);
      setSwitchError(null);
      const res = await fetch("/api/payment/switch-to-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          print_job_id: job.id,
          customer_token: customerToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to switch payment method");
      }
      if (data.job) {
        setJob((prev) => ({ ...prev, ...(data.job as PrintJobRecord) }));
      }
    } catch (err: any) {
      setSwitchError(err.message || "Failed to switch payment method");
    } finally {
      setIsSwitchingToCash(false);
    }
  };

  // Celebrate on completion
  useEffect(() => {
    if (job.status === "completed" && !hasCelebrated) {
      setHasCelebrated(true);
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
      });
    }
  }, [job.status, hasCelebrated]);

  const stages: { key: JobStatus; title: string; desc: string }[] = [
    {
      key: "pending_approval",
      title: "Pending Approval",
      desc: "Storekeeper reviewing request on Windows Agent",
    },
    {
      key: "approved",
      title: "Approved by Storekeeper",
      desc: "Directing stream into printer memory",
    },
    {
      key: "printing",
      title: "Printing Document",
      desc: "Hardware printer actively outputting pages",
    },
    {
      key: "completed",
      title: "Ready for Pickup",
      desc: "Collect your freshly printed sheets at counter",
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
  const isFailed = job.status === "failed";

  return (
    <div className="w-full space-y-5 pb-8 animate-fadeIn">
      {/* Top Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-spin" style={{ animationDuration: "6s" }} />
          <span>Supabase Realtime Connected</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Request Submitted!
        </h2>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100/90 border border-slate-200 text-xs font-bold text-slate-700">
          <Ticket className="w-3.5 h-3.5 text-indigo-600" />
          <span>Ticket #: {job.id.slice(0, 8).toUpperCase()}</span>
        </div>
      </div>

      {/* Pending Payment Notice */}
      {job.status === "pending_payment" && (
        <div className="glass-panel p-4 rounded-3xl bg-amber-50/90 border border-amber-200 text-amber-900 space-y-3 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2 font-bold text-xs">
            <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
            <span>Awaiting Payment Confirmation</span>
          </div>
          <p className="text-xs text-amber-700 font-medium leading-relaxed">
            Payment has not been confirmed yet. You can complete the UPI transaction, or if your UPI app failed or you prefer to pay at the counter, switch to cash right away.
          </p>
          {switchError && (
            <p className="text-[11px] text-rose-600 font-bold bg-rose-50 p-2 rounded-xl border border-rose-200">
              {switchError}
            </p>
          )}
          <button
            type="button"
            onClick={handleSwitchToCash}
            disabled={isSwitchingToCash}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-black text-xs shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSwitchingToCash ? "Updating Payment Mode..." : "Pay Cash at Counter Instead"}
          </button>
        </div>
      )}

      {/* Hardware Print Failed Notice */}
      {isFailed && (
        <div className="glass-panel p-4 rounded-3xl bg-rose-50/90 border border-rose-200 text-rose-800 space-y-1 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2 font-bold text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Hardware Printing Issue</span>
          </div>
          <p className="text-xs text-rose-700 font-medium">
            {job.rejection_reason || "A printer hardware or spooler issue occurred. Please consult the shop counter."}
          </p>
        </div>
      )}

      {/* Rejection / Expired Notice */}
      {isRejected && (
        <div className="glass-panel p-4 rounded-3xl bg-rose-50/90 border border-rose-200 text-rose-800 space-y-1 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Job Declined by Storekeeper</span>
          </div>
          <p className="text-xs text-rose-700 font-medium">
            Reason: {job.rejection_reason || "Unable to print document at this time. Please check with the counter storekeeper."}
          </p>
        </div>
      )}

      {isExpired && (
        <div className="glass-panel p-4 rounded-3xl bg-amber-50/90 border border-amber-200 text-amber-800 space-y-1 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Job Session Expired</span>
          </div>
          <p className="text-xs text-amber-700 font-medium">
            Unclaimed document bytes were safely cleared from memory per zero-disk retention policy.
          </p>
        </div>
      )}

      {/* Progress Stepper Card */}
      {!isRejected && !isExpired && (
        <div className="glass-panel p-5 rounded-3xl border border-white/90 shadow-md space-y-4">
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

                  {/* Step indicator */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all z-10 ${
                      isPassed
                        ? "bg-emerald-500 text-white shadow-xs"
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

                  {/* Stage text */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-xs font-extrabold ${
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
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full animate-pulse">
                          Live Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{stage.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ticket Details Summary */}
      <div className="glass-panel p-4 rounded-3xl border border-white/90 space-y-3 shadow-xs">
        <div className="flex items-center justify-between text-xs font-extrabold text-slate-700">
          <span>Print Summary</span>
          <span className="font-mono text-[11px] text-slate-500 font-normal">
            Token: {customerToken.slice(0, 8)}...
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white/80 p-3 rounded-2xl border border-slate-200/70 shadow-xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Color Mode</span>
            <span className="font-extrabold text-slate-800 capitalize mt-0.5 block">
              {job.color_mode === "bw" ? "Black & White" : "Full Color"}
            </span>
          </div>

          <div className="bg-white/80 p-3 rounded-2xl border border-slate-200/70 shadow-xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Copies &amp; Size</span>
            <span className="font-extrabold text-slate-800 mt-0.5 block">
              {job.copies} × {job.paper_size} {job.duplex ? "(2-Sided)" : ""}
            </span>
          </div>
        </div>

        {/* Zero-Disk Privacy Commitment */}
        <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex items-center gap-2.5 text-[11px] text-emerald-800 font-medium shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Zero-Disk Privacy: File bytes stream straight to printer RAM and vanish immediately.</span>
        </div>
      </div>

      {/* Action Button: Print Another */}
      <button
        type="button"
        onClick={onNewJob}
        className="glass-panel-interactive w-full py-3.5 px-4 rounded-2xl text-slate-700 font-extrabold text-xs shadow-sm flex items-center justify-center gap-2"
      >
        <RotateCcw className="w-4 h-4 text-slate-500" />
        <span>Print Another Document</span>
      </button>
    </div>
  );
};
