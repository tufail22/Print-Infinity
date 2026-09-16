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
import { calculateEstimatedPrice } from "@/config/pricing";

interface PrintPreviewProps {
  files: UploadedFileItem[];
  settings: DetailedPrintSettings;
  totalPages: number;
  onProceedToPayment: () => void;
  onBackToSettings: () => void;
}

export const PrintPreview: React.FC<PrintPreviewProps> = ({
  files,
  settings,
  totalPages,
  onProceedToPayment,
  onBackToSettings,
}) => {
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  const priceBreakdown = calculateEstimatedPrice({
    totalPages,
    copies: settings.copies,
    colorMode: settings.colorMode,
    paperSize: settings.paperSize,
    duplex: settings.duplex,
    quality: settings.quality,
    pagesPerSheet: settings.pagesPerSheet,
  });

  const currentFile = files[activeFileIndex] || files[0];
  const isImage =
    currentFile?.type.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp)$/i.test(currentFile?.name || "");

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
        return "p-4";
    }
  };

  return (
    <div className="w-full space-y-4 animate-fadeIn">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider border border-indigo-100">
            <Eye className="w-3 h-3 text-indigo-600" />
            <span>Interactive Print Sheet</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight mt-1">
            Print Preview
          </h2>
        </div>
        <button
          type="button"
          onClick={onBackToSettings}
          className="text-xs text-indigo-600 font-extrabold hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Edit Settings</span>
        </button>
      </div>

      {/* Sheet Simulation Container */}
      <div className="glass-panel p-5 rounded-3xl border border-white/90 shadow-md flex flex-col items-center">
        {/* Paper Sheet Representation */}
        <div className="w-full flex items-center justify-center py-2">
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
              {/* Document / Image Content Rendering */}
              {isImage && currentFile?.previewUrl ? (
                <div
                  className={`w-full h-full flex items-center justify-center overflow-hidden transition-all ${
                    settings.colorMode === "bw" ? "grayscale contrast-125" : ""
                  }`}
                >
                  <img
                    src={currentFile.previewUrl}
                    alt={currentFile.name}
                    className={`max-w-full max-h-full rounded-xs shadow-xs ${
                      settings.imageScaling === "fill"
                        ? "w-full h-full object-cover"
                        : settings.imageScaling === "actual"
                        ? "object-none"
                        : "object-contain"
                    }`}
                  />
                </div>
              ) : (
                /* PDF / Document Wireframe Simulation */
                <div
                  className={`w-full h-full bg-slate-50/70 border border-dashed border-slate-300 rounded-sm p-3 flex flex-col justify-between transition-all ${
                    settings.colorMode === "bw" ? "grayscale" : ""
                  }`}
                >
                  {/* Header lines */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="text-[10px] font-bold text-slate-800 truncate max-w-[140px]">
                          {currentFile?.name || "Document.pdf"}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400">
                        Page 1 of {currentFile?.totalPages || 1}
                      </span>
                    </div>

                    {/* Simulated Text Lines */}
                    <div className="space-y-1 pt-1">
                      <div className="w-3/4 h-2 bg-slate-300 rounded-full"></div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full"></div>
                      <div className="w-5/6 h-1.5 bg-slate-200 rounded-full"></div>
                      <div className="w-4/5 h-1.5 bg-slate-200 rounded-full"></div>
                    </div>
                  </div>

                  {/* Body wireframe illustration */}
                  <div className="my-auto py-2 flex items-center justify-center">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col items-center">
                      <Printer className="w-5 h-5 text-indigo-500 mb-1" />
                      <span className="text-[9px] font-bold text-slate-600">
                        Ready to Print
                      </span>
                      <span className="text-[8px] text-slate-400">
                        {settings.colorMode === "bw" ? "B&W Standard" : "Full Color CMYK"}
                      </span>
                    </div>
                  </div>

                  {/* Footer lines */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[8px] text-slate-400">
                    <span>Print Infinity Terminal</span>
                    <span>{settings.paperSize}</span>
                  </div>
                </div>
              )}

              {/* Photo Size Framing Badge overlay (if photo size chosen) */}
              {settings.photoSize && (
                <div className="absolute top-1 right-1 bg-black/75 backdrop-blur-xs text-white text-[8px] font-bold px-1.5 py-0.5 rounded-sm shadow-xs">
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
              className="p-1 rounded-lg bg-slate-100 disabled:opacity-30 text-slate-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-600">
              File {activeFileIndex + 1} of {files.length}
            </span>
            <button
              type="button"
              disabled={activeFileIndex >= files.length - 1}
              onClick={() =>
                setActiveFileIndex((prev) => Math.min(files.length - 1, prev + 1))
              }
              className="p-1 rounded-lg bg-slate-100 disabled:opacity-30 text-slate-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Specifications Summary Grid */}
      <div className="glass-panel p-4 rounded-3xl border border-white/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs font-extrabold text-slate-800">
          <span>Print Specifications</span>
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[11px] font-bold">
            Verified Valid
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-white/90 p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">
              Color Output
            </span>
            <span className="font-extrabold text-slate-800 capitalize mt-0.5 block">
              {settings.colorMode === "bw" ? "Black & White (₹3/pg)" : "Full Color (₹10/pg)"}
            </span>
          </div>

          <div className="bg-white/90 p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">
              Paper &amp; Size
            </span>
            <span className="font-extrabold text-slate-800 mt-0.5 block">
              {settings.photoSize ? settings.photoSize : settings.paperSize}{" "}
              {settings.orientation === "landscape" ? "(Land.)" : ""}
            </span>
          </div>

          <div className="bg-white/90 p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">
              Copies &amp; Duplex
            </span>
            <span className="font-extrabold text-slate-800 mt-0.5 block">
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
          className="glass-button-primary w-full py-4 px-5 rounded-2xl text-white font-black text-xs shadow-xl active:scale-[0.98] transition-all flex items-center justify-between"
        >
          <div className="text-left">
            <span className="block text-[10px] text-indigo-100 font-medium">Total Amount</span>
            <span className="text-sm font-black">{priceBreakdown.formattedTotal}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Proceed to Payment</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        <button
          type="button"
          onClick={onBackToSettings}
          className="w-full py-2.5 text-center text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          Modify Settings
        </button>
      </div>
    </div>
  );
};
