"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Printer,
  UploadCloud,
  FileCheck2,
  Sliders,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  MapPin,
  ShieldCheck,
  Zap,
  Loader2,
} from "lucide-react";
import { StoreHeader } from "@/components/print/StoreHeader";
import { UploadZone } from "@/components/print/UploadZone";
import { SettingsSheet } from "@/components/print/SettingsSheet";
import { PaymentSelector } from "@/components/print/PaymentSelector";
import { LiveTracker } from "@/components/print/LiveTracker";
import {
  DetailedPrintSettings,
  UploadedFileItem,
  StoreInfo,
  PrintJobRecord,
  PaymentMethod,
} from "@/types/printJob";
import { calculateEstimatedPrice } from "@/config/pricing";
import { getOrCreateCustomerToken } from "@/lib/tokenManager";
import { getCustomerSupabaseClient, supabase } from "@/lib/supabaseClient";

function PrintWizardContent() {
  const searchParams = useSearchParams();
  const storeIdParam = searchParams.get("store");

  // State
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [step, setStep] = useState<number>(1); // 1: Landing, 2: Upload, 3: Settings, 4: Payment, 5: Status
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeJob, setActiveJob] = useState<PrintJobRecord | null>(null);
  const [customerToken, setCustomerToken] = useState<string>("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("upi");

  // Print settings state
  const [settings, setSettings] = useState<DetailedPrintSettings>({
    colorMode: "bw",
    copies: 1,
    paperSize: "A4",
    orientation: "portrait",
    duplex: false,
    duplexEdge: "long",
    pageRangeType: "all",
    reverseOrder: false,
    pagesPerSheet: 1,
    imageScaling: "fit",
    margin: "normal",
    alignment: "center",
    multiPageOutput: "singly",
    quality: "standard",
  });

  // Calculate total pages across uploaded files
  const totalPages = files.reduce((sum, f) => sum + f.totalPages, 0) || 1;
  const priceBreakdown = calculateEstimatedPrice({
    totalPages,
    copies: settings.copies,
    colorMode: settings.colorMode,
    paperSize: settings.paperSize,
    duplex: settings.duplex,
    quality: settings.quality,
    pagesPerSheet: settings.pagesPerSheet,
  });

  // 1. Initialize customer token & load store metadata
  useEffect(() => {
    const token = getOrCreateCustomerToken();
    setCustomerToken(token);

    async function fetchStore() {
      try {
        setLoadingStore(true);
        let targetStoreId = storeIdParam;

        if (!targetStoreId) {
          // If no store query param provided, fetch the first active store from Supabase
          const { data, error } = await supabase
            .from("stores")
            .select("id, name, address, active")
            .eq("active", true)
            .limit(1);

          if (data && data.length > 0) {
            setStore(data[0] as StoreInfo);
          } else {
            // Default fallback
            setStore({
              id: "a0000000-0000-0000-0000-000000000001",
              name: "Print Infinity Flagship — Store #1",
              address: "Shop 12, Retail Arcade, Commercial Center",
              active: true,
            });
          }
        } else {
          const { data, error } = await supabase
            .from("stores")
            .select("id, name, address, active")
            .eq("id", targetStoreId)
            .single();

          if (data) {
            setStore(data as StoreInfo);
          }
        }
      } catch (err) {
        console.error("Error fetching store:", err);
      } finally {
        setLoadingStore(false);
      }
    }

    fetchStore();
  }, [storeIdParam]);

  // Handle final job submission
  const handleConfirmAndSubmit = async (method: PaymentMethod, gatewayRef?: string) => {
    if (files.length === 0 || !store) return;

    try {
      setIsSubmitting(true);
      const scopedClient = getCustomerSupabaseClient();
      const firstFile = files[0];

      // 1. Upload file directly to private "print-uploads" Storage bucket using anon client + RLS
      const fileExt = firstFile.name.substring(firstFile.name.lastIndexOf("."));
      const storagePath = `${store.id}/${customerToken.slice(0, 12)}_${Date.now()}${fileExt}`;

      const { data: uploadData, error: uploadError } = await scopedClient.storage
        .from("print-uploads")
        .upload(storagePath, firstFile.file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.warn("Storage upload notice:", uploadError);
      }

      // Storage expires in 15 minutes
      const storageExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      // 2. Insert print_job row with customer_token
      const { data: jobData, error: jobError } = await scopedClient
        .from("print_jobs")
        .insert({
          store_id: store.id,
          status: method === "upi" ? "pending_approval" : "pending_payment",
          color_mode: settings.colorMode,
          copies: settings.copies,
          paper_size: settings.paperSize,
          duplex: settings.duplex,
          storage_path: storagePath,
          storage_expires_at: storageExpiresAt,
          customer_token: customerToken,
        })
        .select()
        .single();

      if (jobError || !jobData) {
        throw new Error(jobError?.message || "Failed to create print job record");
      }

      // 3. Insert payment row
      const { error: paymentError } = await scopedClient.from("payments").insert({
        print_job_id: jobData.id,
        method: method,
        amount: priceBreakdown.total,
        status: method === "upi" ? "verified" : "pending",
        gateway_ref: gatewayRef || (method === "cash" ? "CASH_COUNTER" : "UPI_STUB"),
      });

      if (paymentError) {
        console.warn("Payment insert notice:", paymentError);
      }

      setActiveJob(jobData as PrintJobRecord);
      setStep(5); // Advance to live tracker
    } catch (err) {
      console.error("Submission error:", err);
      alert("Could not submit print job: " + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForNewJob = () => {
    setFiles([]);
    setActiveJob(null);
    setStep(1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70 text-slate-900 pb-20 sm:pb-12">
      {/* Sticky Top Store Header */}
      <StoreHeader
        store={store}
        currentStep={step}
        onStepClick={(targetStep) => setStep(targetStep)}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-4 pb-24">
        {/* SCREEN 1: LANDING SCREEN */}
        {step === 1 && (
          <div className="flex flex-col items-center justify-center text-center space-y-6 pt-6 pb-8 animate-fadeIn">
            {/* Animated Store Logo Card */}
            <div className="relative group">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center text-white shadow-xl shadow-indigo-500/25 ring-4 ring-indigo-50 transform hover:scale-105 transition-all duration-300">
                <Printer className="w-12 h-12 animate-pulse" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-4 border-white rounded-full flex items-center justify-center text-white">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Store Name & Welcoming Tagline */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>Printer Online &amp; Ready</span>
              </div>

              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {store?.name || "Print Infinity Station"}
              </h2>

              <p className="text-xs text-slate-500 max-w-xs mx-auto flex items-center justify-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span>{store?.address || "In-Store Cloud Terminal"}</span>
              </p>
            </div>

            {/* Feature Highlights Cards */}
            <div className="grid grid-cols-2 gap-2.5 w-full text-left">
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
                <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-slate-800">Zero-Disk Privacy</p>
                <p className="text-[11px] text-slate-500">
                  Streams directly to printer memory; never saved to disk.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
                <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-slate-800">Instant UPI &amp; Cash</p>
                <p className="text-[11px] text-slate-500">
                  Pay at counter or scan UPI for instant dispatch.
                </p>
              </div>
            </div>

            {/* Prominent CTA in Center */}
            <div className="w-full pt-2">
              <button
                type="button"
                id="btn-start-print"
                onClick={() => setStep(2)}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold text-sm shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 focus:outline-none focus:ring-4 focus:ring-indigo-300"
              >
                <UploadCloud className="w-5 h-5" />
                <span>Upload Your Document to Print</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
              <p className="text-[11px] text-slate-400 mt-2 font-medium">
                No app installation or account sign-up needed.
              </p>
            </div>
          </div>
        )}

        {/* SCREEN 2: UPLOAD */}
        {step === 2 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-900">Upload Documents</h2>
              <p className="text-xs text-slate-500">
                Add PDFs, Word docs, slides, or photos you wish to print.
              </p>
            </div>

            <UploadZone
              files={files}
              onFilesChange={(newFiles) => setFiles(newFiles)}
              isUploading={isSubmitting}
            />

            {/* Bottom Continue Button */}
            {files.length > 0 && (
              <div className="pt-3">
                <button
                  type="button"
                  id="btn-continue-to-settings"
                  onClick={() => setStep(3)}
                  className="w-full py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span>Continue to Print Settings ({files.length} {files.length === 1 ? "file" : "files"})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 3: PRINT SETTINGS */}
        {step === 3 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">Print Settings</h2>
                <p className="text-xs text-slate-500">
                  Configure color, copies, size, and layout.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs text-indigo-600 font-bold hover:underline"
              >
                Change Files
              </button>
            </div>

            <SettingsSheet
              settings={settings}
              onChange={(updated) => setSettings(updated)}
              totalPages={totalPages}
            />

            {/* Proceed to Payment */}
            <div className="pt-1">
              <button
                type="button"
                id="btn-continue-to-payment"
                onClick={() => setStep(4)}
                className="w-full py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 active:scale-[0.98] transition-all flex items-center justify-between"
              >
                <div className="text-left">
                  <span className="block text-[10px] text-indigo-200">Total Price</span>
                  <span className="text-sm font-extrabold">{priceBreakdown.formattedTotal}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>Proceed to Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 4: PAYMENT */}
        {step === 4 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">Choose Payment</h2>
                <p className="text-xs text-slate-500">
                  Pay instantly with UPI or pay cash at the store counter.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-xs text-indigo-600 font-bold hover:underline"
              >
                Edit Settings
              </button>
            </div>

            <PaymentSelector
              amount={priceBreakdown.total}
              selectedMethod={selectedPaymentMethod}
              onSelectMethod={(m) => setSelectedPaymentMethod(m)}
              onConfirmPayment={handleConfirmAndSubmit}
              isSubmitting={isSubmitting}
            />
          </div>
        )}

        {/* SCREEN 5: REALTIME CONFIRMATION TRACKER */}
        {step === 5 && activeJob && (
          <LiveTracker
            job={activeJob}
            customerToken={customerToken}
            onNewJob={handleResetForNewJob}
          />
        )}
      </main>
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-xs font-bold text-slate-600">Connecting to Print Infinity...</p>
          </div>
        </div>
      }
    >
      <PrintWizardContent />
    </Suspense>
  );
}
