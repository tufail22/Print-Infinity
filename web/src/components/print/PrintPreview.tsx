"use client";

import React, { useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  ArrowRight,
  ArrowLeft,
  Eye,
  CheckCircle2,
  Printer,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  ZoomIn,
} from "lucide-react";
import {
  DetailedPrintSettings,
  UploadedFileItem,
  StoreInfo,
} from "@/types/printJob";
import { calculateEstimatedPrice, getPricingConfigForStore } from "@/config/pricing";

interface PrintPreviewProps {
  files: UploadedFileItem[];
  settings: DetailedPrintSettings;
  totalPages: number;
  store?: StoreInfo | null;
  onProceedToPayment: () => void;
  onBackToSettings: () => void;
}

export const PrintPreview: React.FC<PrintPreviewProps> = ({
  files,
  settings,
  totalPages,
  store,
  onProceedToPayment,
  onBackToSettings,
}) => {
  const [activeFileIndex, setActiveFileIndex] = useState(0);

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
      pageRangeType: settings.pageRangeType,
      customPageRange: settings.customPageRange,
      photoSize: settings.photoSize,
    },
    pricingConfig
  );

  const currentFile = files[activeFileIndex] || files[0];
  const isPdf =
    currentFile?.type === "application/pdf" ||
    /\.pdf$/i.test(currentFile?.name || "");
  const isImage =
    currentFile?.type.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(currentFile?.name || "");

  // Aspect ratio based on orientation
  const isLandscape = settings.orientation === "landscape";

  // Margin styling
  const getMarginClass = () => {
    switch (settings.margin) {
      case "narrow":
        return "p-2";
      case "wide":
        return "p-6";
      case "none":
        return "p-0";
      default:
        return "p-3.5";
    }
  };

  // Photo size aspect ratio mapping for framing box
  const getPhotoAspectRatio = () => {
    if (!settings.photoSize) return "";
    switch (settings.photoSize) {
      case "4 x 6 in.":
      case "100 x 148 mm (Hagaki)":
        return isLandscape ? "aspect-[6/4]" : "aspect-[4/6]";
      case "5 x 7 in.":
        return isLandscape ? "aspect-[7/5]" : "aspect-[5/7]";
      case "8 x 10 in.":
        return isLandscape ? "aspect-[10/8]" : "aspect-[8/10]";
      case "3.5 x 5 in.":
        return isLandscape ? "aspect-[5/3.5]" : "aspect-[3.5/5]";
      case "2 x 3 in. (Wallet)":
      case "6 x 8 cm (Wallet)":
        return isLandscape ? "aspect-[3/2]" : "aspect-[2/3]";
      default:
        return "";
    }
  };

  return (
    <div className="w-full space-y-4 animate-fadeIn">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 text-[10px] font-black uppercase tracking-wider border border-indigo-200">
            <Eye className="w-3 h-3 text-indigo-700" aria-hidden="true" />
            <span>Interactive Print Sheet</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight mt-1">
            Print Preview
          </h2>
        </div>
        <button
          type="button"
          onClick={onBackToSettings}
          aria-label="Back to print settings"
          className="min-h-[44px] min-w-[44px] px-2 text-xs text-indigo-700 font-extrabold hover:text-indigo-900 hover:underline flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Edit Settings</span>
        </button>
      </div>

      {/* Sheet Simulation Container */}
      <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-white/90 shadow-md flex flex-col items-center">
        {/* Visual Settings Feedback Badge */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
            <span>Active Settings Simulation</span>
          </span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
            {settings.colorMode === "bw" ? "⚫ B&W Grayscale" : "🎨 Full Color CMYK"} • {settings.orientation}
          </span>
        </div>

        {/* Paper Sheet Representation */}
        <div className="w-full flex items-center justify-center py-3">
          <div
            className={`relative bg-white shadow-2xl rounded-sm border border-slate-300 transition-all duration-300 overflow-hidden flex flex-col justify-between ${
              isLandscape
                ? "w-full aspect-[297/210] max-w-[340px]"
                : "w-[240px] aspect-[210/297]"
            }`}
          >
            {/* Sheet Margin Box & Printable Area */}
            <div
              className={`w-full h-full flex flex-col items-center justify-center relative ${getMarginClass()}`}
            >
              {/* 1. REAL PDF PREVIEW RENDERING */}
              {isPdf && currentFile?.previewUrl ? (
                <div
                  className={`w-full h-full relative overflow-hidden rounded-xs transition-all duration-300 ${
                    settings.colorMode === "bw"
                      ? "grayscale contrast-125 brightness-95"
                      : "contrast-105"
                  } ${getPhotoAspectRatio()}`}
                >
                  <object
                    data={`${currentFile.previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                    type="application/pdf"
                    className="w-full h-full pointer-events-none rounded-xs"
                    aria-label={`PDF live preview of ${currentFile.name}`}
                  >
                    <iframe
                      src={`${currentFile.previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                      title={`PDF live preview of ${currentFile.name}`}
                      className="w-full h-full pointer-events-none border-none"
                    />
                  </object>
                </div>
              ) : isImage && currentFile?.previewUrl ? (
                /* 2. REAL IMAGE PREVIEW RENDERING */
                <div
                  className={`w-full h-full flex items-center justify-center overflow-hidden transition-all duration-300 ${
                    settings.colorMode === "bw"
                      ? "grayscale contrast-125 brightness-95"
                      : ""
                  } ${getPhotoAspectRatio()}`}
                >
                  <img
                    src={currentFile.previewUrl}
                    alt={`Print preview for ${currentFile.name}`}
                    loading="lazy"
                    decoding="async"
                    className={`max-w-full max-h-full rounded-xs shadow-xs transition-all ${
                      settings.imageScaling === "fill"
                        ? "w-full h-full object-cover"
                        : settings.imageScaling === "actual"
                        ? "object-none"
                        : "object-contain"
                    }`}
                  />
                </div>
              ) : (
                /* 3. High-Fidelity Document Representation (for office/text files without direct canvas) */
                <div
                  className={`w-full h-full bg-slate-50 border border-dashed border-slate-300 rounded-sm p-3 flex flex-col justify-between transition-all ${
                    settings.colorMode === "bw" ? "grayscale" : ""
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-700" aria-hidden="true" />
                        <span className="text-[11px] font-bold text-slate-800 truncate max-w-[140px]">
                          {currentFile?.name || "Document"}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-600">
                        1 / {currentFile?.totalPages || 1}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="w-3/4 h-2 bg-slate-300 rounded-full"></div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full"></div>
                      <div className="w-5/6 h-1.5 bg-slate-200 rounded-full"></div>
                      <div className="w-4/5 h-1.5 bg-slate-200 rounded-full"></div>
                    </div>
                  </div>

                  <div className="my-auto py-2 flex items-center justify-center">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col items-center">
                      <Printer className="w-5 h-5 text-indigo-600 mb-1" aria-hidden="true" />
                      <span className="text-[10px] font-bold text-slate-700">
                        Ready to Print
                      </span>
                      <span className="text-[9px] font-semibold text-slate-500">
                        {settings.colorMode === "bw" ? "B&W Standard" : "Full Color"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[9px] font-bold text-slate-500">
                    <span>Print Infinity</span>
                    <span>{settings.paperSize}</span>
                  </div>
                </div>
              )}

              {/* Photo Size Framing Badge overlay (if photo size chosen) */}
              {settings.photoSize && (
                <div className="absolute top-1 right-1 bg-slate-900/85 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm shadow-xs border border-white/20">
                  {settings.photoSize}
                </div>
              )}
            </div>

            {/* Simulated Paper Edge Shadow */}
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_12px_rgba(0,0,0,0.04)]" />
          </div>
        </div>

        {/* File Navigator (if multiple files) */}
        {files.length > 1 && (
          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={activeFileIndex <= 0}
              onClick={() => setActiveFileIndex((prev) => Math.max(0, prev - 1))}
              aria-label="View previous document"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <span className="text-xs font-bold text-slate-700">
              Document {activeFileIndex + 1} of {files.length}
            </span>
            <button
              type="button"
              disabled={activeFileIndex >= files.length - 1}
              onClick={() =>
                setActiveFileIndex((prev) => Math.min(files.length - 1, prev + 1))
              }
              aria-label="View next document"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Specifications Summary Grid */}
      <div className="glass-panel p-4 rounded-3xl border border-white/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs font-extrabold text-slate-900">
          <span>Print Specifications</span>
          <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
            Verified Valid
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-white/95 p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] text-slate-600 font-bold uppercase block">
              Color Output
            </span>
            <span className="font-extrabold text-slate-900 capitalize mt-0.5 block">
              {settings.colorMode === "bw"
                ? `Black & White (₹${pricingConfig.rates.bwPerPage}/pg)`
                : `Full Color (₹${pricingConfig.rates.colorPerPage}/pg)`}
            </span>
          </div>

          <div className="bg-white/95 p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] text-slate-600 font-bold uppercase block">
              Paper &amp; Size
            </span>
            <span className="font-extrabold text-slate-900 mt-0.5 block">
              {settings.photoSize ? settings.photoSize : settings.paperSize}{" "}
              {settings.orientation === "landscape" ? "(Landscape)" : ""}
            </span>
          </div>

          <div className="bg-white/95 p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] text-slate-600 font-bold uppercase block">
              Copies &amp; Duplex
            </span>
            <span className="font-extrabold text-slate-900 mt-0.5 block">
              {settings.copies} {settings.copies === 1 ? "copy" : "copies"} •{" "}
              {settings.duplex ? "2-Sided" : "1-Sided"}
            </span>
          </div>
        </div>
      </div>

      {/* Proceed to Payment Action */}
      <div className="pt-2 space-y-2">
        <button
          type="button"
          id="btn-proceed-from-preview"
          onClick={onProceedToPayment}
          aria-label={`Proceed to payment. Total amount ${priceBreakdown.formattedTotal}`}
          className="glass-button-primary min-h-[52px] w-full py-4 px-5 rounded-2xl text-white font-black text-xs shadow-xl active:scale-[0.98] transition-all flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
        >
          <div className="text-left">
            <span className="block text-[10px] text-indigo-100 font-medium">Total Amount</span>
            <span className="text-sm font-black">{priceBreakdown.formattedTotal}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Proceed to Payment</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </div>
        </button>

        <button
          type="button"
          onClick={onBackToSettings}
          aria-label="Back to modify print settings"
          className="min-h-[44px] w-full py-2.5 text-center text-xs font-bold text-slate-700 hover:text-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-lg flex items-center justify-center"
        >
          Modify Settings
        </button>
      </div>
    </div>
  );
};
