"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  UploadCloud,
  CheckCircle2,
  ArrowRight,
  MapPin,
  Loader2,
  Eye,
  Lock,
  Zap,
} from "lucide-react";
import { StoreHeader } from "@/components/print/StoreHeader";
import { UploadZone } from "@/components/print/UploadZone";
import { SettingsSheet } from "@/components/print/SettingsSheet";
import { PrintPreview } from "@/components/print/PrintPreview";
import { PaymentSelector } from "@/components/print/PaymentSelector";
import { LiveTracker } from "@/components/print/LiveTracker";
import {
  DetailedPrintSettings,
  UploadedFileItem,
  StoreInfo,
  PrintJobRecord,
  PaymentMethod,
} from "@/types/printJob";
import { calculateEstimatedPrice, getPricingConfigForStore } from "@/config/pricing";
import { getOrCreateCustomerToken, rotateCustomerToken } from "@/lib/tokenManager";
import { getCustomerSupabaseClient, supabase } from "@/lib/supabaseClient";

function PrintWizardContent() {
  const searchParams = useSearchParams();
  const storeIdParam = searchParams.get("store");

  // State: 1: Landing, 2: Upload, 3: Settings, 4: Preview, 5: Payment, 6: Status
  const [step, setStep] = useState<number>(1);
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeJob, setActiveJob] = useState<PrintJobRecord | null>(null);
  const [customerToken, setCustomerToken] = useState<string>("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("upi");

  // Check if any uploaded files are images
  const hasImages = files.some(
    (f) =>
      f.type.startsWith("image/") ||
      /\.(jpg|jpeg|png|webp)$/i.test(f.name)
  );

  // Print settings state
  const [settings, setSettings] = useState<DetailedPrintSettings>({
    colorMode: "bw",
    copies: 1,
    paperSize: "A4",
    photoSize: "Full page",
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

  // Automatically select Color mode when images are uploaded
  useEffect(() => {
    if (hasImages && settings.colorMode === "bw") {
      setSettings((prev) => ({
        ...prev,
        colorMode: "color",
        photoSize: prev.photoSize || "Full page",
      }));
    }
  }, [hasImages]);

  // Calculate total pages across uploaded files
  const totalPages = files.reduce((sum, f) => sum + f.totalPages, 0) || 1;
  const pricingConfig = getPricingConfigForStore(store);
  const priceBreakdown = calculateEstimatedPrice(
    {
      totalPages,
      copies: settings.copies,
      colorMode: settings.colorMode,
      paperSize: settings.paperSize,
      duplex: settings.duplex,
      quality: settings.quality,
      pagesPerSheet: settings.pagesPerSheet,
    },
    pricingConfig
  );

  // Initialize customer token & load store metadata
  useEffect(() => {
    const token = getOrCreateCustomerToken();
    setCustomerToken(token);

    async function fetchStore() {
      try {
        setLoadingStore(true);
        let targetStoreId = storeIdParam;

        if (!targetStoreId) {
          const { data } = await supabase
            .from("stores")
            .select("id, name, address, active, logo_url, bw_price_per_page, color_price_per_page")
            .eq("active", true)
            .limit(1);

          if (data && data.length > 0) {
            targetStoreId = data[0].id;
            setStore(data[0] as StoreInfo);
          } else {
            // Fallback default flagship store
            setStore({
              id: "a0000000-0000-0000-0000-000000000001",
              name: "Print Infinity Flagship",
              address: "Shop 12, Retail Arcade, Commercial Center",
              active: true,
              bw_price_per_page: 3.0,
              color_price_per_page: 10.0,
            });
          }
        } else {
          const { data } = await supabase
            .from("stores")
            .select("id, name, address, active, logo_url, bw_price_per_page, color_price_per_page")
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
      const firstFile = files[0];
      const jobToken = rotateCustomerToken();
      setCustomerToken(jobToken);
      const scopedClient = getCustomerSupabaseClient(jobToken);

      // 1. Upload file directly to private "print-uploads" Storage bucket using anon client + RLS
      const fileExt = firstFile.name.substring(firstFile.name.lastIndexOf("."));
      const storagePath = `${store.id}/${jobToken.slice(0, 12)}_${Date.now()}${fileExt}`;

      const { error: uploadError } = await scopedClient.storage
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
      const paperSizeVal = settings.photoSize ? settings.photoSize : settings.paperSize;

      // 2. Submit via validated, rate-limited server endpoint
      let jobData: any = null;
      try {
        const createRes = await fetch("/api/print-jobs/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_id: store.id,
            color_mode: settings.colorMode,
            copies: settings.copies,
            paper_size: paperSizeVal,
            duplex: settings.duplex,
            storage_path: storagePath,
            customer_token: jobToken,
            page_count: totalPages,
            method: method,
            amount: priceBreakdown.total,
            gateway_ref: gatewayRef || (method === "cash" ? "CASH_COUNTER" : "RAZORPAY_INIT"),
          }),
        });

        if (createRes.status === 429) {
          throw new Error("Too many print requests. Please wait a moment before trying again.");
        }

        const createJson = await createRes.json();
        if (!createRes.ok || !createJson.job) {
          throw new Error(createJson.error || "Failed to create print job via server");
        }
        jobData = createJson.job;
      } catch (serverErr: any) {
        if (serverErr.message?.includes("Too many")) {
          throw serverErr;
        }
        console.warn("Server job creation notice, trying direct client insert:", serverErr);
        // Resilient fallback to direct Supabase client (secured by DB RLS & triggers)
        const { data: directJob, error: jobError } = await scopedClient
          .from("print_jobs")
          .insert({
            store_id: store.id,
            status: "pending_payment",
            color_mode: settings.colorMode,
            copies: settings.copies,
            paper_size: paperSizeVal,
            duplex: settings.duplex,
            storage_path: storagePath,
            storage_expires_at: storageExpiresAt,
            customer_token: jobToken,
          })
          .select()
          .single();

        if (jobError || !directJob) {
          throw new Error(jobError?.message || "Failed to create print job record");
        }
        jobData = directJob;

        await scopedClient.from("payments").insert({
          print_job_id: jobData.id,
          method: method,
          amount: priceBreakdown.total,
          status: "pending",
          gateway_ref: gatewayRef || (method === "cash" ? "CASH_COUNTER" : "RAZORPAY_INIT"),
        });
      }

      // 4. For UPI: Create Razorpay Order via server-side API and launch Razorpay Checkout
      if (method === "upi") {
        try {
          const orderRes = await fetch("/api/payment/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              print_job_id: jobData.id,
              amount: priceBreakdown.total,
              customer_token: jobToken,
            }),
          });

          if (orderRes.ok) {
            const orderData = await orderRes.json();
            
            // Load Razorpay SDK dynamically
            const loadScript = (): Promise<boolean> => {
              return new Promise((resolve) => {
                if (typeof window !== "undefined" && (window as any).Razorpay) {
                  resolve(true);
                  return;
                }
                const script = document.createElement("script");
                script.src = "https://checkout.razorpay.com/v1/checkout.js";
                script.onload = () => resolve(true);
                script.onerror = () => resolve(false);
                document.body.appendChild(script);
              });
            };

            const isLoaded = await loadScript();
            if (isLoaded && (window as any).Razorpay) {
              const rzp = new (window as any).Razorpay({
                key: orderData.keyId,
                amount: orderData.amount,
                currency: orderData.currency || "INR",
                name: "Print Infinity",
                description: `Print Job (${jobData.id.slice(0, 8)})`,
                order_id: orderData.orderId,
                theme: { color: "#4f46e5" },
                modal: {
                  ondismiss: () => {
                    // Navigate to tracker; Supabase Realtime will reflect webhook status
                    setActiveJob(jobData as PrintJobRecord);
                    setStep(6);
                  },
                },
                handler: () => {
                  // Customer completed payment; Realtime webhook will flip status to pending_approval
                  setActiveJob(jobData as PrintJobRecord);
                  setStep(6);
                },
              });
              rzp.open();
              return;
            }
          }
        } catch (rzpErr) {
          console.warn("[Razorpay] Order creation notice:", rzpErr);
        }
      }

      setActiveJob(jobData as PrintJobRecord);
      setStep(6); // Advance to live tracker (Step 6)
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
    rotateCustomerToken();
    setStep(1);
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-900 pb-20 sm:pb-12">
      {/* Sticky Glassmorphic Top Header */}
      <StoreHeader
        store={store}
        currentStep={step}
        onStepClick={(targetStep) => setStep(targetStep)}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-3 pb-24">
        {/* SCREEN 1: LANDING SCREEN */}
        {step === 1 && (
          <div className="flex flex-col items-center justify-center text-center space-y-6 pt-5 pb-8 animate-fadeIn">
            {/* Animated Official Print Infinity Logo Badge */}
            <div className="relative group animate-float">
              <div className="w-28 h-28 rounded-3xl overflow-hidden bg-black p-1 shadow-2xl shadow-indigo-500/25 border-2 border-white/80 flex items-center justify-center transform group-hover:scale-105 transition-all duration-300">
                <img
                  src="/logo.png"
                  alt="Print Infinity Brand Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 border-3 border-white rounded-full flex items-center justify-center text-white shadow-sm">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            </div>

            {/* Store Name & Welcoming Tagline */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50/90 text-emerald-800 text-xs font-black border border-emerald-200/80 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>Printer Online &amp; Ready</span>
              </div>

              <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                Print Infinity
              </h2>

              <p className="text-xs text-slate-500 max-w-xs mx-auto flex items-center justify-center gap-1 font-medium">
                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span>{store?.address || "In-Store Terminal"}</span>
              </p>
            </div>

            {/* Feature Highlights Cards: Easy & Fast and Privacy Focused */}
            <div className="grid grid-cols-2 gap-3 w-full text-left">
              {/* Easy & Fast Card */}
              <div className="glass-panel p-4 rounded-3xl border border-white/90 shadow-sm space-y-1.5">
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-xs">
                  <Zap className="w-4.5 h-4.5" />
                </div>
                <p className="text-xs font-extrabold text-slate-800">Easy &amp; Fast</p>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Print your documents in seconds with quickly
                </p>
              </div>

              {/* Privacy Focused Card */}
              <div className="glass-panel p-4 rounded-3xl border border-white/90 shadow-sm space-y-1.5">
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-xs">
                  <Lock className="w-4.5 h-4.5" />
                </div>
                <p className="text-xs font-extrabold text-slate-800">Privacy Focused</p>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Your documents are encrypted and automatically deleted after printing
                </p>
              </div>
            </div>

            {/* Prominent CTA in Center */}
            <div className="w-full pt-1">
              <button
                type="button"
                id="btn-start-print"
                onClick={() => setStep(2)}
                className="glass-button-primary w-full py-4 px-6 rounded-2xl text-white font-black text-sm shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 focus:outline-none focus:ring-4 focus:ring-indigo-300"
              >
                <UploadCloud className="w-5 h-5" />
                <span>Upload Your Document to Print</span>
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </button>
              <p className="text-[11px] text-slate-400 mt-2 font-medium">
                No app install, no account registration required.
              </p>
            </div>
          </div>
        )}

        {/* SCREEN 2: UPLOAD */}
        {step === 2 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Upload Documents</h2>
              <p className="text-xs text-slate-500 font-medium">
                Add PDFs, Word documents, presentations, or photos to print.
              </p>
            </div>

            <UploadZone
              files={files}
              onFilesChange={(newFiles) => setFiles(newFiles)}
              isUploading={isSubmitting}
            />

            {/* Continue Button */}
            {files.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  id="btn-continue-to-settings"
                  onClick={() => setStep(3)}
                  className="glass-button-primary w-full py-3.5 px-5 rounded-2xl text-white font-extrabold text-xs shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span>
                    Continue to Print Settings ({files.length} {files.length === 1 ? "document" : "documents"})
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 3: PRINT SETTINGS */}
        {step === 3 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Print Settings</h2>
                <p className="text-xs text-slate-500 font-medium">
                  Customize colors, copies, sizing, and paper layout.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs text-indigo-600 font-extrabold hover:underline"
              >
                Change Files
              </button>
            </div>

            <SettingsSheet
              settings={settings}
              onChange={(updated) => setSettings(updated)}
              totalPages={totalPages}
              hasImages={hasImages}
            />

            {/* Proceed to Preview */}
            <div className="pt-1">
              <button
                type="button"
                id="btn-continue-to-preview"
                onClick={() => setStep(4)}
                className="glass-button-primary w-full py-3.5 px-5 rounded-2xl text-white font-black text-xs shadow-xl active:scale-[0.98] transition-all flex items-center justify-between"
              >
                <div className="text-left">
                  <span className="block text-[10px] text-indigo-100 font-medium">Total Amount</span>
                  <span className="text-sm font-black">{priceBreakdown.formattedTotal}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4" />
                  <span>Preview Document</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 4: PRINT PREVIEW */}
        {step === 4 && (
          <PrintPreview
            files={files}
            settings={settings}
            totalPages={totalPages}
            store={store}
            onProceedToPayment={() => setStep(5)}
            onBackToSettings={() => setStep(3)}
          />
        )}

        {/* SCREEN 5: PAYMENT */}
        {step === 5 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Choose Payment</h2>
                <p className="text-xs text-slate-500 font-medium">
                  Pay instantly via UPI or pay cash at the store counter.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="text-xs text-indigo-600 font-extrabold hover:underline"
              >
                Back to Preview
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

        {/* SCREEN 6: REALTIME CONFIRMATION TRACKER */}
        {step === 6 && activeJob && (
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

export function PrintWizard() {
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
