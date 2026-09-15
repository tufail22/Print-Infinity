"use client";

import React, { useState } from "react";
import {
  Palette,
  FileSpreadsheet,
  Copy,
  Layout,
  Maximize2,
  Minimize2,
  Sparkles,
  Sliders,
  ChevronDown,
  ChevronUp,
  Check,
  Zap,
  Info,
  Layers,
  ArrowDownUp,
  BookOpen,
} from "lucide-react";
import {
  DetailedPrintSettings,
  ColorMode,
  Orientation,
  PageRangeType,
  MultiPageOutput,
  PrintQuality,
  PaperMargin,
  ImageScaling,
} from "@/types/printJob";
import { calculateEstimatedPrice } from "@/config/pricing";

interface SettingsSheetProps {
  settings: DetailedPrintSettings;
  onChange: (updated: DetailedPrintSettings) => void;
  totalPages: number;
}

export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  settings,
  onChange,
  totalPages,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoTunedToast, setAutoTunedToast] = useState(false);

  const priceBreakdown = calculateEstimatedPrice({
    totalPages,
    copies: settings.copies,
    colorMode: settings.colorMode,
    paperSize: settings.paperSize,
    duplex: settings.duplex,
    quality: settings.quality,
    pagesPerSheet: settings.pagesPerSheet,
  });

  const handleUpdate = (partial: Partial<DetailedPrintSettings>) => {
    onChange({ ...settings, ...partial });
  };

  // Smart Auto-Tune: Automatically picks optimal settings
  const handleAutoTune = () => {
    const optimized: DetailedPrintSettings = {
      ...settings,
      colorMode: "bw", // Default to economical B&W
      paperSize: "A4",
      orientation: "portrait",
      duplex: totalPages > 1, // Enable duplex automatically for multi-page documents
      duplexEdge: "long",
      pageRangeType: "all",
      reverseOrder: false,
      pagesPerSheet: 1,
      imageScaling: "fit",
      margin: "normal",
      alignment: "center",
      multiPageOutput: "singly",
      quality: "standard",
      autoTuned: true,
    };
    onChange(optimized);
    setAutoTunedToast(true);
    setTimeout(() => setAutoTunedToast(false), 3000);
  };

  const paperSizes = [
    { id: "A4", label: "A4", desc: "210 × 297 mm (Standard)" },
    { id: "Letter", label: "Letter", desc: "8.5 × 11 in" },
    { id: "Legal", label: "Legal", desc: "8.5 × 14 in" },
    { id: "A3", label: "A3", desc: "297 × 420 mm (Large)" },
    { id: "A5", label: "A5", desc: "148 × 210 mm (Half A4)" },
    { id: "B5", label: "B5", desc: "176 × 250 mm" },
    { id: "Custom", label: "Custom Size", desc: "Set in cm / inch" },
  ];

  return (
    <div className="w-full space-y-5 pb-6">
      {/* Smart Auto-Tune Banner */}
      <div className="relative overflow-hidden p-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-sky-600 text-white shadow-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <p className="text-xs font-bold leading-tight">Smart Auto-Tune</p>
            <p className="text-[11px] text-indigo-100">
              Automatically set printer configuration error-free
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAutoTune}
          className="px-3 py-1.5 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs shadow-sm active:scale-95 transition-all flex items-center gap-1.5 focus:ring-2 focus:ring-white"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Apply</span>
        </button>
      </div>

      {autoTunedToast && (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Settings optimized for best print accuracy and cost!</span>
        </div>
      )}

      {/* 1. Color Mode Toggle (Big Accessible Cards) */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase">
          Color Mode
        </label>
        <div
          role="radiogroup"
          aria-label="Color Mode"
          className="grid grid-cols-2 gap-3"
        >
          {/* Black & White */}
          <button
            type="button"
            role="radio"
            aria-checked={settings.colorMode === "bw"}
            onClick={() => handleUpdate({ colorMode: "bw" })}
            className={`relative p-3.5 rounded-2xl border-2 text-left transition-all focus:outline-none focus:ring-4 focus:ring-indigo-100 ${
              settings.colorMode === "bw"
                ? "border-slate-800 bg-slate-900 text-white shadow-md"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200">
                <FileSpreadsheet className="w-4 h-4" />
              </span>
              {settings.colorMode === "bw" && (
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">
                  <Check className="w-3 h-3" />
                </span>
              )}
            </div>
            <div className="mt-2.5">
              <div className="font-bold text-sm">Black &amp; White</div>
              <div
                className={`text-[11px] ${
                  settings.colorMode === "bw" ? "text-slate-300" : "text-slate-500"
                }`}
              >
                ₹2.00 / page (Standard)
              </div>
            </div>
          </button>

          {/* Full Color */}
          <button
            type="button"
            role="radio"
            aria-checked={settings.colorMode === "color"}
            onClick={() => handleUpdate({ colorMode: "color" })}
            className={`relative p-3.5 rounded-2xl border-2 text-left transition-all focus:outline-none focus:ring-4 focus:ring-indigo-100 ${
              settings.colorMode === "color"
                ? "border-indigo-600 bg-gradient-to-br from-indigo-50 via-white to-sky-50 text-indigo-950 shadow-md ring-1 ring-indigo-500"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 via-amber-400 to-indigo-500 flex items-center justify-center text-white shadow-sm">
                <Palette className="w-4 h-4" />
              </span>
              {settings.colorMode === "color" && (
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                  <Check className="w-3 h-3" />
                </span>
              )}
            </div>
            <div className="mt-2.5">
              <div className="font-bold text-sm">Full Color</div>
              <div className="text-[11px] text-slate-500">
                ₹10.00 / page (Vibrant)
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Number of Copies Stepper */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Copy className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">Number of Copies</p>
            <p className="text-[11px] text-slate-500">Sets of document</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => handleUpdate({ copies: Math.max(1, settings.copies - 1) })}
            disabled={settings.copies <= 1}
            aria-label="Decrease copies"
            className="w-8 h-8 rounded-lg bg-white disabled:opacity-40 text-slate-700 font-bold shadow-sm flex items-center justify-center active:scale-95 transition-all"
          >
            -
          </button>
          <span className="w-8 text-center font-extrabold text-sm text-slate-800">
            {settings.copies}
          </span>
          <button
            type="button"
            onClick={() => handleUpdate({ copies: settings.copies + 1 })}
            aria-label="Increase copies"
            className="w-8 h-8 rounded-lg bg-white text-slate-700 font-bold shadow-sm flex items-center justify-center active:scale-95 transition-all"
          >
            +
          </button>
        </div>
      </div>

      {/* 3. Paper Size & Custom Size Option */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase">
          Paper Size
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {paperSizes.map((size) => {
            const isSelected = settings.paperSize === size.id;
            return (
              <button
                key={size.id}
                type="button"
                onClick={() => handleUpdate({ paperSize: size.id })}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/80 text-indigo-900 font-bold shadow-sm ring-1 ring-indigo-500"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <div className="text-xs font-bold">{size.label}</div>
                <div className="text-[10px] text-slate-500 truncate">{size.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Custom Paper Size Input if selected */}
        {settings.paperSize === "Custom" && (
          <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3 mt-2 animate-fadeIn">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-indigo-900">Custom Dimensions</p>
              <div className="flex rounded-lg bg-white p-0.5 border border-indigo-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() =>
                    handleUpdate({
                      customPaperSize: {
                        width: settings.customPaperSize?.width || 21,
                        height: settings.customPaperSize?.height || 29.7,
                        unit: "cm",
                      },
                    })
                  }
                  className={`px-2 py-0.5 rounded-md ${
                    settings.customPaperSize?.unit !== "inch"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600"
                  }`}
                >
                  cm
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdate({
                      customPaperSize: {
                        width: settings.customPaperSize?.width || 8.5,
                        height: settings.customPaperSize?.height || 11,
                        unit: "inch",
                      },
                    })
                  }
                  className={`px-2 py-0.5 rounded-md ${
                    settings.customPaperSize?.unit === "inch"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600"
                  }`}
                >
                  inch
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">Width</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.customPaperSize?.width || 21}
                  onChange={(e) =>
                    handleUpdate({
                      customPaperSize: {
                        width: parseFloat(e.target.value) || 1,
                        height: settings.customPaperSize?.height || 29.7,
                        unit: settings.customPaperSize?.unit || "cm",
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">Height</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.customPaperSize?.height || 29.7}
                  onChange={(e) =>
                    handleUpdate({
                      customPaperSize: {
                        width: settings.customPaperSize?.width || 21,
                        height: parseFloat(e.target.value) || 1,
                        unit: settings.customPaperSize?.unit || "cm",
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Orientation & Duplex (Two Column Cards) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Orientation */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2">
          <label className="block text-[11px] font-bold text-slate-600 uppercase">
            Orientation
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => handleUpdate({ orientation: "portrait" })}
              className={`py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                settings.orientation === "portrait"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <div className="w-3.5 h-4.5 border-2 border-current rounded-sm"></div>
              <span>Portrait</span>
            </button>

            <button
              type="button"
              onClick={() => handleUpdate({ orientation: "landscape" })}
              className={`py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                settings.orientation === "landscape"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <div className="w-4.5 h-3.5 border-2 border-current rounded-sm"></div>
              <span>Landscape</span>
            </button>
          </div>
        </div>

        {/* Double-Sided / Duplex */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2">
          <label className="block text-[11px] font-bold text-slate-600 uppercase">
            Double Sided
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => handleUpdate({ duplex: false })}
              className={`py-2 rounded-xl text-xs font-bold transition-all ${
                !settings.duplex
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Single
            </button>

            <button
              type="button"
              onClick={() => handleUpdate({ duplex: true })}
              className={`py-2 rounded-xl text-xs font-bold transition-all ${
                settings.duplex
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Double (2-sided)
            </button>
          </div>
        </div>
      </div>

      {/* 5. Page Range & Reverse Order */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 uppercase">
            Pages to Print
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.reverseOrder}
              onChange={(e) => handleUpdate({ reverseOrder: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-[11px] font-medium">Reverse order</span>
          </label>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {(["all", "odd", "even", "custom"] as PageRangeType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleUpdate({ pageRangeType: type })}
              className={`py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                settings.pageRangeType === type
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {type === "all" ? "All" : type === "odd" ? "Odd" : type === "even" ? "Even" : "Custom"}
            </button>
          ))}
        </div>

        {settings.pageRangeType === "custom" && (
          <div className="pt-1">
            <input
              type="text"
              placeholder="e.g. 1-5, 8, 11-13"
              value={settings.customPageRange || ""}
              onChange={(e) => handleUpdate({ customPageRange: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Enter page numbers and ranges separated by commas.
            </p>
          </div>
        )}
      </div>

      {/* Collapsible: Advanced Size & Layout, Multi-Page, Quality */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-50/70 hover:bg-slate-100 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span>More Layout, Quality &amp; Multi-Page Options</span>
          </span>
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showAdvanced && (
          <div className="p-4 space-y-4 border-t border-slate-100 animate-fadeIn">
            {/* Pages Per Sheet */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase">
                Pages Per Sheet (N-Up)
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 4, 6, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleUpdate({ pagesPerSheet: num })}
                    className={`py-1.5 rounded-lg text-xs font-bold ${
                      settings.pagesPerSheet === num
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {num} on 1
                  </button>
                ))}
              </div>
            </div>

            {/* Multi-Page Output Mode */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase">
                Document Output Mode
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["singly", "multiple", "poster", "booklet"] as MultiPageOutput[]).map(
                  (mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleUpdate({ multiPageOutput: mode })}
                      className={`py-1.5 rounded-lg text-xs font-bold capitalize ${
                        settings.multiPageOutput === mode
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {mode}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Print Quality */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase">
                Print Quality
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["eco", "standard", "high", "best"] as PrintQuality[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleUpdate({ quality: q })}
                    className={`py-1.5 rounded-lg text-xs font-bold capitalize ${
                      settings.quality === q
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Margins & Scaling */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Margins
                </label>
                <select
                  value={settings.margin}
                  onChange={(e) => handleUpdate({ margin: e.target.value as PaperMargin })}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                >
                  <option value="normal">Normal Margins</option>
                  <option value="narrow">Narrow Margins</option>
                  <option value="wide">Wide Margins</option>
                  <option value="none">Border-less / None</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Image Scaling
                </label>
                <select
                  value={settings.imageScaling}
                  onChange={(e) =>
                    handleUpdate({ imageScaling: e.target.value as ImageScaling })
                  }
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                >
                  <option value="fit">Fit to Printable Area</option>
                  <option value="fill">Fill Entire Page</option>
                  <option value="actual">Actual Size (100%)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Estimated Price Breakdown Card */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Live Estimated Total
            </span>
          </div>
          <span className="text-2xl font-black text-white tracking-tight">
            {priceBreakdown.formattedTotal}
          </span>
        </div>

        <div className="pt-2 border-t border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-white/5 rounded-xl p-2">
            <p className="text-[10px] text-slate-400">Total Sheets</p>
            <p className="font-bold text-white mt-0.5">
              {priceBreakdown.effectivePages}
            </p>
          </div>

          <div className="bg-white/5 rounded-xl p-2">
            <p className="text-[10px] text-slate-400">Rate / page</p>
            <p className="font-bold text-white mt-0.5">
              ₹{priceBreakdown.basePageRate.toFixed(2)}
            </p>
          </div>

          <div className="bg-white/5 rounded-xl p-2">
            <p className="text-[10px] text-slate-400">Savings</p>
            <p className="font-bold text-emerald-400 mt-0.5">
              {priceBreakdown.discountAmount > 0
                ? `-₹${priceBreakdown.discountAmount.toFixed(2)}`
                : "₹0.00"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
