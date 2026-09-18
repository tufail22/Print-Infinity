"use client";

import React from "react";
import {
  QrCode,
  Banknote,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Loader2,
  Check,
  Zap,
  CreditCard,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { PaymentMethod } from "@/types/printJob";

interface PaymentSelectorProps {
  amount: number;
  selectedMethod: PaymentMethod;
  onSelectMethod: (method: PaymentMethod) => void;
  onConfirmPayment: (method: PaymentMethod, gatewayRef?: string) => void;
  isSubmitting?: boolean;
}

export const PaymentSelector: React.FC<PaymentSelectorProps> = ({
  amount,
  selectedMethod,
  onSelectMethod,
  onConfirmPayment,
  isSubmitting = false,
}) => {
  const formattedAmount = `₹${amount.toFixed(2)}`;

  return (
    <div className="w-full space-y-4">
      {/* Total Amount Glass Card */}
      <div className="glass-panel p-5 rounded-3xl border border-white/90 flex items-center justify-between shadow-sm bg-white/70 backdrop-blur-md">
        <div>
          <p className="text-[11px] text-slate-500 font-extrabold uppercase tracking-wider">
            Total Amount Due
          </p>
          <p className="text-3xl font-black text-slate-900 mt-0.5 tracking-tight">
            {formattedAmount}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200/80 shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Verified Safe</span>
        </div>
      </div>

      {/* Two Large Selection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* UPI / Online Option */}
        <button
          type="button"
          onClick={() => onSelectMethod("upi")}
          aria-label="Pay with UPI or Cards via Razorpay"
          className={`glass-panel-interactive relative p-5 rounded-3xl text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
            selectedMethod === "upi"
              ? "border-indigo-600 bg-white/95 shadow-xl ring-2 ring-indigo-500/30 scale-[1.01]"
              : "border-slate-200/80 bg-white/60 hover:bg-white/80 hover:border-slate-300"
          }`}
        >
          {selectedMethod === "upi" && (
            <div
              className="absolute top-4 right-4 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shadow-xs font-bold"
              aria-hidden="true"
            >
              <Check className="w-3.5 h-3.5" />
            </div>
          )}

          <div
            className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 mb-3"
            aria-hidden="true"
          >
            <QrCode className="w-6 h-6" />
          </div>

          <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
            Pay Online (UPI / Cards)
          </h3>
          <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
            Google Pay, PhonePe, Paytm, BHIM, Cards &amp; NetBanking
          </p>

          <div className="mt-3.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50/90 px-2.5 py-1 rounded-lg border border-indigo-100">
            <Zap className="w-3 h-3 text-amber-500" aria-hidden="true" />
            <span>Instant Auto-Print Approval</span>
          </div>
        </button>

        {/* Cash at Counter Option */}
        <button
          type="button"
          onClick={() => onSelectMethod("cash")}
          aria-label="Pay Cash at Store Counter"
          className={`glass-panel-interactive relative p-5 rounded-3xl text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
            selectedMethod === "cash"
              ? "border-emerald-600 bg-white/95 shadow-xl ring-2 ring-emerald-500/30 scale-[1.01]"
              : "border-slate-200/80 bg-white/60 hover:bg-white/80 hover:border-slate-300"
          }`}
        >
          {selectedMethod === "cash" && (
            <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs shadow-xs font-bold">
              <Check className="w-3.5 h-3.5" />
            </div>
          )}

          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 mb-3">
            <Banknote className="w-6 h-6" />
          </div>

          <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
            Pay Cash at Counter
          </h3>
          <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
            Pay the storekeeper in person at the shop counter
          </p>

          <div className="mt-3.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50/90 px-2.5 py-1 rounded-lg border border-emerald-100">
            <Clock className="w-3 h-3 text-emerald-600" />
            <span>Storekeeper Confirms Cash</span>
          </div>
        </button>
      </div>

      {/* UPI / Razorpay Gateway Panel */}
      {selectedMethod === "upi" && (
        <div className="glass-panel p-5 rounded-3xl border border-indigo-100 shadow-lg bg-gradient-to-b from-white/95 to-indigo-50/40 text-center space-y-4 animate-fadeIn">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100/70 text-indigo-800 text-[11px] font-extrabold border border-indigo-200/60">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Razorpay Standard Checkout</span>
            </div>
            <h4 className="text-base font-black text-slate-900">
              Fast, Seamless &amp; Contactless Payment
            </h4>
            <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
              Click below to launch the official Razorpay checkout modal with dynamic UPI QR code, 1-click app payment, and debit/credit card options.
            </p>
          </div>

          {/* Payment Method Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 py-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> GPay / PhonePe
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> Paytm / BHIM
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold shadow-xs">
              <CreditCard className="w-3.5 h-3.5 text-purple-600" /> Cards &amp; NetBanking
            </span>
          </div>

          {/* Pay Button */}
          <div className="w-full space-y-2 pt-1">
            <button
              type="button"
              id="btn-confirm-upi"
              disabled={isSubmitting}
              onClick={() => onConfirmPayment("upi")}
              className="glass-button-primary w-full py-4 px-6 rounded-2xl text-white font-black text-sm shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 focus:outline-none focus:ring-4 focus:ring-indigo-300"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Opening Razorpay Checkout...</span>
                </>
              ) : (
                <>
                  <span>Pay with Razorpay ({formattedAmount})</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Razorpay Secured • Real-time Cloud Confirmation to Shop PC</span>
            </div>
          </div>
        </div>
      )}

      {/* Cash at Counter Panel */}
      {selectedMethod === "cash" && (
        <div className="glass-panel p-5 rounded-3xl border border-emerald-100 shadow-md bg-gradient-to-b from-white/95 to-emerald-50/30 space-y-4 animate-fadeIn">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/70 text-emerald-800 text-[11px] font-extrabold border border-emerald-200/60">
              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              <span>In-Person Cash Workflow</span>
            </div>
            <h4 className="text-base font-black text-slate-900">
              Pay Directly at the Store Counter
            </h4>
          </div>

          {/* 3 Simple Steps */}
          <div className="grid grid-cols-1 gap-2.5 text-left">
            <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-white/80 border border-slate-100">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                1
              </span>
              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                Click <span className="font-bold text-slate-900">Confirm &amp; Submit Job</span> below. Your documents are uploaded securely.
              </p>
            </div>
            <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-white/80 border border-slate-100">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                2
              </span>
              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                Head to the shop counter and show your live order tracking screen.
              </p>
            </div>
            <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-white/80 border border-slate-100">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                3
              </span>
              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                Pay <span className="font-bold text-emerald-700">{formattedAmount}</span> cash. Storekeeper clicks &ldquo;Collect Cash &amp; Print&rdquo; on their PC and prints immediately!
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-1">
            <button
              type="button"
              id="btn-confirm-cash"
              disabled={isSubmitting}
              onClick={() => onConfirmPayment("cash")}
              className="w-full py-4 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 focus:outline-none focus:ring-4 focus:ring-slate-300"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Submitting Print Request...</span>
                </>
              ) : (
                <>
                  <span>Confirm Job &amp; Pay Cash ({formattedAmount})</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
