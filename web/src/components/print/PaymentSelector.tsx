"use client";

import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  QrCode,
  Banknote,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  ArrowRight,
  Sparkles,
  Loader2,
  Check,
  Zap,
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
  const [upiPolling, setUpiPolling] = useState(false);
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string | null>(null);

  const formattedAmount = `₹${amount.toFixed(2)}`;

  // Generate UPI Intent URI
  const upiIntentUri = `upi://pay?pa=printinfinity.store@upi&pn=Print%20Infinity&am=${amount.toFixed(
    2
  )}&cu=INR&tn=Print%20Job%20Payment`;

  useEffect(() => {
    if (selectedMethod === "upi") {
      QRCode.toDataURL(
        upiIntentUri,
        {
          width: 240,
          margin: 1,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        },
        (err, url) => {
          if (!err && url) {
            setUpiQrDataUrl(url);
          }
        }
      );
    }
  }, [selectedMethod, upiIntentUri]);

  // Simulate payment confirmation polling
  const handleSimulateUpiSuccess = () => {
    setUpiPolling(true);
    setTimeout(() => {
      setUpiPolling(false);
      onConfirmPayment("upi", "UPI_REF_" + Math.random().toString(36).substring(2, 10).toUpperCase());
    }, 1200);
  };

  return (
    <div className="w-full space-y-4">
      {/* Total Amount Glass Card */}
      <div className="glass-panel p-4 rounded-3xl border border-white/90 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            Total Amount Due
          </p>
          <p className="text-2xl font-black text-indigo-950 mt-0.5 tracking-tight">
            {formattedAmount}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200/80 shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Verified Safe</span>
        </div>
      </div>

      {/* Two Large Premium Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* UPI Option */}
        <button
          type="button"
          onClick={() => onSelectMethod("upi")}
          aria-label="Select Pay with UPI (Instant Auto-Dispatch)"
          className={`glass-panel-interactive relative p-5 rounded-3xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
            selectedMethod === "upi"
              ? "border-indigo-600 bg-white/95 shadow-xl ring-2 ring-indigo-500/30"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          {selectedMethod === "upi" && (
            <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shadow-xs font-bold" aria-hidden="true">
              <Check className="w-3.5 h-3.5" />
            </div>
          )}

          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 mb-3" aria-hidden="true">
            <QrCode className="w-6 h-6" />
          </div>

          <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
            Pay with UPI
          </h3>
          <p className="text-xs text-slate-600 mt-1 font-medium">
            Scan with GPay, PhonePe, Paytm or any UPI App
          </p>

          <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
            <Zap className="w-3 h-3 text-amber-500" aria-hidden="true" />
            <span>Instant Auto-Dispatch</span>
          </div>
        </button>

        {/* Cash Option */}
        <button
          type="button"
          onClick={() => onSelectMethod("cash")}
          aria-label="Select Pay with Cash at Store Counter"
          className={`glass-panel-interactive relative p-5 rounded-3xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${
            selectedMethod === "cash"
              ? "border-emerald-600 bg-white/95 shadow-xl ring-2 ring-emerald-500/30"
              : "border-slate-200 hover:border-slate-300"
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
            Pay with Cash at Counter
          </h3>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Pay directly in cash to the storekeeper before printing
          </p>

          <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
            <span>Storekeeper Confirms</span>
          </div>
        </button>
      </div>

      {/* UPI Interactive QR View */}
      {selectedMethod === "upi" && (
        <div className="glass-panel p-5 rounded-3xl border border-indigo-100/80 shadow-md flex flex-col items-center text-center space-y-4 animate-fadeIn">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Scan QR Code to Pay {formattedAmount}</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Open Google Pay, PhonePe, Paytm, or BHIM
            </p>
          </div>

          {/* QR Code */}
          <div className="p-3.5 bg-white rounded-3xl border-2 border-indigo-100 shadow-inner">
            {upiQrDataUrl ? (
              <img
                src={upiQrDataUrl}
                alt="UPI Payment QR Code"
                className="w-48 h-48 rounded-2xl object-contain mx-auto"
              />
            ) : (
              <div className="w-48 h-48 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            )}
          </div>

          <div className="w-full space-y-2">
            <button
              type="button"
              id="btn-confirm-upi"
              disabled={isSubmitting}
              onClick={() => onConfirmPayment("upi")}
              className="glass-button-primary w-full py-3.5 px-4 rounded-2xl text-white font-extrabold text-xs shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Initiating Razorpay UPI Gateway...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Pay via Razorpay UPI ({formattedAmount})</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Razorpay Secure Test Gateway • Instant Webhook Verification</span>
            </div>
          </div>
        </div>
      )}

      {/* Cash Confirm Button & Move to Next Step */}
      {selectedMethod === "cash" && (
        <div className="glass-panel p-4 rounded-3xl border border-emerald-100/90 shadow-sm space-y-3 animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Banknote className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Pay Cash at Store Counter</p>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Submit this job now. The storekeeper will verify your cash payment on their Windows terminal to approve and print.
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-confirm-cash"
            disabled={isSubmitting}
            onClick={() => onConfirmPayment("cash")}
            className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting Request...</span>
              </>
            ) : (
              <>
                <span>Confirm Cash Payment &amp; Submit ({formattedAmount})</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
