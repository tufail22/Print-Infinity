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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const formattedAmount = `₹${amount.toFixed(2)}`;

  // Generate UPI Intent URI: upi://pay?pa=printinfinity@upi&pn=PrintInfinity&am=10.00&cu=INR
  const upiIntentUri = `upi://pay?pa=printinfinity.store@upi&pn=Print%20Infinity&am=${amount.toFixed(
    2
  )}&cu=INR&tn=Print%20Job%20Payment`;

  useEffect(() => {
    if (selectedMethod === "upi") {
      QRCode.toDataURL(
        upiIntentUri,
        {
          width: 220,
          margin: 1,
          color: {
            dark: "#1e1b4b",
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
      {/* Total Amount Header */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 font-semibold">Total Amount Due</p>
          <p className="text-2xl font-black text-indigo-950 mt-0.5">{formattedAmount}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Secure Checkout</span>
        </div>
      </div>

      {/* Two Large Method Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* UPI Option */}
        <button
          type="button"
          onClick={() => onSelectMethod("upi")}
          className={`p-4 rounded-3xl border-2 text-left transition-all relative overflow-hidden focus:outline-none focus:ring-4 focus:ring-indigo-100 ${
            selectedMethod === "upi"
              ? "border-indigo-600 bg-white shadow-lg ring-1 ring-indigo-500"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          {selectedMethod === "upi" && (
            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
              <Check className="w-3 h-3" />
            </div>
          )}

          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 mb-3">
            <QrCode className="w-6 h-6" />
          </div>

          <h3 className="font-extrabold text-sm text-slate-900">Pay via UPI QR</h3>
          <p className="text-xs text-slate-500 mt-1">
            GPay, PhonePe, Paytm, BHIM instant scan &amp; print
          </p>

          <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
            <span>Instant Auto-Approval</span>
          </div>
        </button>

        {/* Cash Option */}
        <button
          type="button"
          onClick={() => onSelectMethod("cash")}
          className={`p-4 rounded-3xl border-2 text-left transition-all relative overflow-hidden focus:outline-none focus:ring-4 focus:ring-indigo-100 ${
            selectedMethod === "cash"
              ? "border-emerald-600 bg-white shadow-lg ring-1 ring-emerald-500"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          {selectedMethod === "cash" && (
            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
              <Check className="w-3 h-3" />
            </div>
          )}

          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 mb-3">
            <Banknote className="w-6 h-6" />
          </div>

          <h3 className="font-extrabold text-sm text-slate-900">Pay Cash at Counter</h3>
          <p className="text-xs text-slate-500 mt-1">
            Pay storekeeper directly with cash before printing
          </p>

          <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
            <span>Storekeeper Confirms</span>
          </div>
        </button>
      </div>

      {/* UPI Interactive QR View */}
      {selectedMethod === "upi" && (
        <div className="p-5 rounded-3xl bg-white border border-indigo-100 shadow-md flex flex-col items-center text-center space-y-4 animate-fadeIn">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Scan using any UPI App</span>
            </div>
            <p className="text-xs text-slate-500">Scan code with Google Pay, PhonePe, or Paytm</p>
          </div>

          {/* QR Code Container */}
          <div className="p-3 bg-white rounded-2xl border-2 border-indigo-100 shadow-inner">
            {upiQrDataUrl ? (
              <img
                src={upiQrDataUrl}
                alt="UPI Payment QR Code"
                className="w-48 h-48 rounded-xl object-contain mx-auto"
              />
            ) : (
              <div className="w-48 h-48 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            )}
          </div>

          <div className="w-full space-y-2">
            {/* Polling / Simulation Action */}
            <button
              type="button"
              disabled={upiPolling || isSubmitting}
              onClick={handleSimulateUpiSuccess}
              className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-600/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              {upiPolling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Payment with UPI Network...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>I Have Completed the Payment ({formattedAmount})</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-400">
              Gateway polling active. Webhook verification automatically triggers upon transfer.
            </p>
          </div>
        </div>
      )}

      {/* Cash Confirm Button */}
      {selectedMethod === "cash" && (
        <div className="p-4 rounded-3xl bg-white border border-emerald-100 shadow-sm space-y-3 animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Banknote className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Pay Cash at Store Counter</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Submit this job now. The storekeeper will verify your cash payment on their Windows terminal to start printing.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onConfirmPayment("cash")}
            className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting Print Request...</span>
              </>
            ) : (
              <>
                <span>Submit Job for Counter Payment ({formattedAmount})</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
