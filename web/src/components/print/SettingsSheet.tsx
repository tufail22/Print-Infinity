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
  SlidersHorizontal,
  Compass,
  FileBox,
  Image as ImageIcon,
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
  PhotoSize,
} from "@/types/printJob";
import { calculateEstimatedPrice } from "@/config/pricing";

interface SettingsSheetProps {
  settings: DetailedPrintSettings;
  onChange: (updated: DetailedPrintSettings) => void;
  totalPages: number;
  hasImages?: boolean;
}

export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  settings,
  onChange,
  totalPages,
  hasImages = false,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoTunedToast, setAutoTunedToast] = useState<string | null>(null);

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

  // Smart Auto-Tune: Accurately optimizes settings based on content
  const handleAutoTune = () => {
    if (hasImages) {
      // Photo / Image optimization: auto color, high quality, single-sided, photo sizing
      const optimized: DetailedPrintSettings = {
        ...settings,
        colorMode: "color", // Auto select color for photos!
        photoSize: settings.photoSize || "Full page",
        paperSize: "A4",
        orientation: "portrait",
        duplex: false, // Photos are almost always single-sided
        pageRangeType: "all",
        reverseOrder: false,
        pagesPerSheet: 1,
        imageScaling: "fit",
        margin: "normal",
        alignment: "center",
        multiPageOutput: "singly",
        quality: "high",
        autoTuned: true,
      };
      onChange(optimized);
      setAutoTunedToast("Smart Auto-Tune: Applied Full Color & Photo optimizations!");
    } else {
      // Standard document / PDF optimization
      const optimized: DetailedPrintSettings = {
        ...settings,
        colorMode: "bw", // Economical B&W for text docs
        paperSize: "A4",
        orientation: "portrait",
        duplex: totalPages > 1, // Double-sided if multi-page
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
      setAutoTunedToast("Smart Auto-Tune: Applied optimal B&W document settings!");
    }

    setTimeout(() => setAutoTunedToast(null), 3000);
  };

  const paperSizes = [
    { id: "A4", label: "A4", desc: "210 × 297 mm (Default)" },
    { id: "Letter", label: "Letter", desc: "8.5 × 11 in" },
    { id: "Legal", label: "Legal", desc: "8.5 × 14 in" },
    { id: "A3", label: "A3", desc: "297 × 420 mm (Large)" },
    { id: "A5", label: "A5", desc: "148 × 210 mm" },
    { id: "B5", label: "B5", desc: "176 × 250 mm" },
    { id: "Tabloid", label: "Tabloid", desc: "11 × 17 in" },
    { id: "Custom", label: "Custom Size", desc: "Set cm / inch" },
  ];

  const photoSizes: { id: PhotoSize; label: string; desc: string }[] = [
    { id: "Full page", label: "Full page", desc: "Fit entire sheet" },
    { id: "8 x 10 in.", label: "8 × 10 in.", desc: "Standard portrait" },
    { id: "5 x 7 in.", label: "5 × 7 in.", desc: "Desk photo frame" },
    { id: "4 x 6 in.", label: "4 × 6 in.", desc: "Classic postcard" },
    { id: "100 x 148 mm (Hagaki)", label: "100 × 148 mm", desc: "Hagaki postcard" },
    { id: "3.5 x 5 in.", label: "3.5 × 5 in.", desc: "Mini snapshot" },
    { id: "2 x 3 in. (Wallet)", label: "2 × 3 in.", desc: "Wallet photo" },
    { id: "6 x 8 cm (Wallet)", label: "6 × 8 cm", desc: "Wallet portrait" },
    { id: "Custom Size", label: "Custom Size", desc: "Custom in / cm" },
  ];

  return (
    <div className="w-full space-y-4 pb-4">
      {/* Smart Auto-Tune Glassmorphic Banner */}
      <div className="relative overflow-hidden p-4 rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-sky-500 text-white shadow-lg shadow-indigo-500/20 flex items-center justify-between gap-3 border border-white/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0 shadow-inner">
            <Zap className="w-5 h-5 text-amber-300 animate-pulse" />
          </div>
          <div>
            <p className="text-xs font-black tracking-tight">⚡ Smart Auto-Tune</p>
            <p className="text-[11px] text-indigo-100 font-medium">
              {hasImages
                ? "Auto-sets Full Color & Photo framing"
                : "Auto-configures error-free printer settings"}
            </p>
          </div>
        </div>

        <button
          type="button"
          id="btn-apply-autotune"
          onClick={handleAutoTune}
          className="px-3.5 py-1.5 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 font-black text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Apply</span>
        </button>
      </div>

      {autoTunedToast && (
        <div className="p-3 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-sm animate-bounce">
          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{autoTunedToast}</span>
        </div>
      )}

      {/* 1. Color Mode Toggle (Updated ₹3.00 B&W / ₹10.00 Color) */}
      <div className="space-y-2">
        <label className="block text-xs font-extrabold text-slate-700 tracking-wider uppercase">
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
            className={`glass-panel-interactive relative p-4 rounded-3xl text-left focus:outline-none focus:ring-4 focus:ring-indigo-100 ${
              settings.colorMode === "bw"
                ? "border-slate-800 bg-slate-900 text-white shadow-xl ring-2 ring-slate-800/50"
                : "border-slate-200 hover:border-slate-300 text-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="w-9 h-9 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 shadow-sm">
                <FileSpreadsheet className="w-4.5 h-4.5" />
              </span>
              {settings.colorMode === "bw" && (
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs shadow-xs font-bold">
                  ✓
                </span>
              )}
            </div>
            <div className="mt-3">
              <div className="font-extrabold text-sm tracking-tight">Black &amp; White</div>
              <div
                className={`text-[11px] font-medium mt-0.5 ${
                  settings.colorMode === "bw" ? "text-slate-300" : "text-slate-500"
                }`}
              >
                ₹3.00 / page (Standard)
              </div>
            </div>
          </button>

          {/* Full Color */}
          <button
            type="button"
            role="radio"
            aria-checked={settings.colorMode === "color"}
            onClick={() => handleUpdate({ colorMode: "color" })}
            className={`glass-panel-interactive relative p-4 rounded-3xl text-left focus:outline-none focus:ring-4 focus:ring-indigo-100 ${
              settings.colorMode === "color"
                ? "border-indigo-500 bg-gradient-to-br from-indigo-50/90 via-white/90 to-sky-50/90 text-indigo-950 shadow-xl ring-2 ring-indigo-500/40"
                : "border-slate-200 hover:border-slate-300 text-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-pink-500 via-amber-400 to-indigo-500 flex items-center justify-center text-white shadow-sm">
                <Palette className="w-4.5 h-4.5" />
              </span>
              {settings.colorMode === "color" && (
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shadow-xs font-bold">
                  ✓
                </span>
              )}
            </div>
            <div className="mt-3">
              <div className="font-extrabold text-sm tracking-tight text-indigo-950">
                Full Color
              </div>
              <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                ₹10.00 / page (Vibrant CMYK)
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Photo Size Selector (When Image Uploaded) */}
      {hasImages && (
        <div className="space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-indigo-900 tracking-wider uppercase flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
              <span>Photo Sizes</span>
            </label>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              Photo Printing Active
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {photoSizes.map((size) => {
              const isSelected = settings.photoSize === size.id;
              return (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => handleUpdate({ photoSize: size.id })}
                  className={`p-2.5 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/90 text-indigo-900 font-extrabold shadow-sm ring-1 ring-indigo-500"
                      : "glass-panel border-slate-200/80 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <div className="text-xs font-bold truncate">{size.label}</div>
                  <div className="text-[10px] text-slate-500 truncate">{size.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Custom Photo Size Inputs */}
          {settings.photoSize === "Custom Size" && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200 space-y-2.5 mt-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold text-indigo-900">Custom Photo Dimension</p>
                <div className="flex rounded-lg bg-white p-0.5 border border-indigo-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdate({
                        customPhotoSize: {
                          width: settings.customPhotoSize?.width || 10,
                          height: settings.customPhotoSize?.height || 15,
                          unit: "cm",
                        },
                      })
                    }
                    className={`px-2 py-0.5 rounded-md ${
                      settings.customPhotoSize?.unit !== "inch"
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
                        customPhotoSize: {
                          width: settings.customPhotoSize?.width || 4,
                          height: settings.customPhotoSize?.height || 6,
                          unit: "inch",
                        },
                      })
                    }
                    className={`px-2 py-0.5 rounded-md ${
                      settings.customPhotoSize?.unit === "inch"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-600"
                    }`}
                  >
                    inch
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Photo Width
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.customPhotoSize?.width || (settings.customPhotoSize?.unit === "inch" ? 4 : 10)}
                    onChange={(e) =>
                      handleUpdate({
                        customPhotoSize: {
                          width: parseFloat(e.target.value) || 1,
                          height: settings.customPhotoSize?.height || (settings.customPhotoSize?.unit === "inch" ? 6 : 15),
                          unit: settings.customPhotoSize?.unit || "inch",
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Photo Height
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.customPhotoSize?.height || (settings.customPhotoSize?.unit === "inch" ? 6 : 15)}
                    onChange={(e) =>
                      handleUpdate({
                        customPhotoSize: {
                          width: settings.customPhotoSize?.width || (settings.customPhotoSize?.unit === "inch" ? 4 : 10),
                          height: parseFloat(e.target.value) || 1,
                          unit: settings.customPhotoSize?.unit || "inch",
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Number of Copies Stepper */}
      <div className="glass-panel flex items-center justify-between p-4 rounded-3xl border border-white/90 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100/80 text-indigo-600 flex items-center justify-center shadow-xs">
            <Copy className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-slate-800 tracking-tight">
              Number of Copies
            </p>
            <p className="text-[11px] text-slate-500 font-medium">Sets to print</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => handleUpdate({ copies: Math.max(1, settings.copies - 1) })}
            disabled={settings.copies <= 1}
            aria-label="Decrease copies"
            className="w-8 h-8 rounded-xl bg-white disabled:opacity-40 text-slate-700 font-black shadow-xs flex items-center justify-center active:scale-95 transition-all text-sm"
          >
            -
          </button>
          <span className="w-8 text-center font-black text-sm text-slate-800">
            {settings.copies}
          </span>
          <button
            type="button"
            onClick={() => handleUpdate({ copies: settings.copies + 1 })}
            aria-label="Increase copies"
            className="w-8 h-8 rounded-xl bg-white text-slate-700 font-black shadow-xs flex items-center justify-center active:scale-95 transition-all text-sm"
          >
            +
          </button>
        </div>
      </div>

      {/* 4. Paper Sizes & Custom Size Feature */}
      <div className="space-y-2">
        <label className="block text-xs font-extrabold text-slate-700 tracking-wider uppercase">
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
                className={`p-2.5 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/90 text-indigo-900 font-extrabold shadow-sm ring-1 ring-indigo-500"
                    : "glass-panel border-slate-200/80 text-slate-700 hover:border-slate-300"
                }`}
              >
                <div className="text-xs font-bold">{size.label}</div>
                <div className="text-[10px] text-slate-500 truncate">{size.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Custom Paper Size Inputs */}
        {settings.paperSize === "Custom" && (
          <div className="p-4 rounded-3xl bg-indigo-50/80 border border-indigo-200/90 space-y-3 mt-2 animate-fadeIn shadow-inner">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold text-indigo-900">Custom Sizing (W × H)</p>
              <div className="flex rounded-xl bg-white p-0.5 border border-indigo-200 text-xs font-bold shadow-xs">
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
                  className={`px-2.5 py-1 rounded-lg ${
                    settings.customPaperSize?.unit !== "inch"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 hover:text-slate-900"
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
                  className={`px-2.5 py-1 rounded-lg ${
                    settings.customPaperSize?.unit === "inch"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  inch
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Width ({settings.customPaperSize?.unit || "cm"})
                </label>
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Height ({settings.customPaperSize?.unit || "cm"})
                </label>
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Orientation & Duplex */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-panel p-3.5 rounded-3xl border border-white/90 shadow-sm space-y-2">
          <label className="block text-[11px] font-extrabold text-slate-600 uppercase">
            Orientation
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => handleUpdate({ orientation: "portrait" })}
              className={`py-2.5 rounded-2xl text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                settings.orientation === "portrait"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-slate-100/90 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <div className="w-3.5 h-5 border-2 border-current rounded-xs"></div>
              <span>Portrait</span>
            </button>

            <button
              type="button"
              onClick={() => handleUpdate({ orientation: "landscape" })}
              className={`py-2.5 rounded-2xl text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                settings.orientation === "landscape"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-slate-100/90 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <div className="w-5 h-3.5 border-2 border-current rounded-xs"></div>
              <span>Landscape</span>
            </button>
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-3xl border border-white/90 shadow-sm space-y-2">
          <label className="block text-[11px] font-extrabold text-slate-600 uppercase">
            Double Sided
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => handleUpdate({ duplex: false })}
              className={`py-2.5 rounded-2xl text-xs font-bold transition-all ${
                !settings.duplex
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-slate-100/90 text-slate-600 hover:bg-slate-200"
              }`}
            >
              1-Sided
            </button>

            <button
              type="button"
              onClick={() => handleUpdate({ duplex: true })}
              className={`py-2.5 rounded-2xl text-xs font-bold transition-all ${
                settings.duplex
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-slate-100/90 text-slate-600 hover:bg-slate-200"
              }`}
            >
              2-Sided
            </button>
          </div>
        </div>
      </div>

      {/* 6. Page Range + Custom Ranges, Odd/Even & Reverse Order */}
      <div className="glass-panel p-4 rounded-3xl border border-white/90 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-extrabold text-slate-700 uppercase">
            Page Selection
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.reverseOrder}
              onChange={(e) => handleUpdate({ reverseOrder: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-[11px] font-bold">Print in reverse order</span>
          </label>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {(["all", "odd", "even", "custom"] as PageRangeType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleUpdate({ pageRangeType: type })}
              className={`py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                settings.pageRangeType === type
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100/80 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {type === "all" ? "All" : type === "odd" ? "Odd" : type === "even" ? "Even" : "Custom"}
            </button>
          ))}
        </div>

        {settings.pageRangeType === "custom" && (
          <div className="pt-1 animate-fadeIn">
            <input
              type="text"
              placeholder="e.g. 1-3, 5, 8-10"
              value={settings.customPageRange || ""}
              onChange={(e) => handleUpdate({ customPageRange: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Specify page numbers and comma-separated ranges.
            </p>
          </div>
        )}
      </div>

      {/* 7. Collapsible Advanced Layout Options */}
      <div className="glass-panel rounded-3xl border border-white/90 overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-4 py-3.5 flex items-center justify-between text-xs font-extrabold text-slate-700 bg-white/50 hover:bg-white/80 transition-colors"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            <span>More Layout, Multi-Page &amp; Quality Options</span>
          </span>
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showAdvanced && (
          <div className="p-4 space-y-4 border-t border-slate-100/90 animate-fadeIn">
            {/* Pages Per Sheet */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-extrabold text-slate-600 uppercase">
                Pages Per Sheet (Image per page)
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 4, 6, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleUpdate({ pagesPerSheet: num })}
                    className={`py-1.5 rounded-xl text-xs font-bold ${
                      settings.pagesPerSheet === num
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100/80 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {num} on 1
                  </button>
                ))}
              </div>
            </div>

            {/* Multi-Page Output Mode */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-extrabold text-slate-600 uppercase">
                Multi-Page Printing Option
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["singly", "multiple", "poster", "booklet"] as MultiPageOutput[]).map(
                  (mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleUpdate({ multiPageOutput: mode })}
                      className={`py-2 rounded-xl text-xs font-bold capitalize ${
                        settings.multiPageOutput === mode
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-slate-100/80 text-slate-600 hover:bg-slate-200"
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
              <label className="block text-[11px] font-extrabold text-slate-600 uppercase">
                Print Quality
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["eco", "standard", "high", "best"] as PrintQuality[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleUpdate({ quality: q })}
                    className={`py-2 rounded-xl text-xs font-bold capitalize ${
                      settings.quality === q
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100/80 text-slate-600 hover:bg-slate-200"
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
                <label className="block text-[11px] font-extrabold text-slate-600 uppercase mb-1">
                  Margins
                </label>
                <select
                  value={settings.margin}
                  onChange={(e) => handleUpdate({ margin: e.target.value as PaperMargin })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-bold text-slate-800 shadow-xs"
                >
                  <option value="normal">Normal Margins</option>
                  <option value="narrow">Narrow Margins</option>
                  <option value="wide">Wide Margins</option>
                  <option value="none">Borderless / None</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 uppercase mb-1">
                  Image Scaling
                </label>
                <select
                  value={settings.imageScaling}
                  onChange={(e) =>
                    handleUpdate({ imageScaling: e.target.value as ImageScaling })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-bold text-slate-800 shadow-xs"
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

      {/* 8. Live Estimated Price Breakdown Card */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl shadow-indigo-950/20 space-y-3 border border-indigo-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
              Live Estimated Total
            </span>
          </div>
          <span className="text-2xl font-black text-white tracking-tight">
            {priceBreakdown.formattedTotal}
          </span>
        </div>

        <div className="pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-white/5 rounded-2xl p-2">
            <p className="text-[10px] text-slate-400 font-medium">Effective Sheets</p>
            <p className="font-extrabold text-white mt-0.5">
              {priceBreakdown.effectivePages}
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-2">
            <p className="text-[10px] text-slate-400 font-medium">Rate / Page</p>
            <p className="font-extrabold text-white mt-0.5">
              ₹{priceBreakdown.basePageRate.toFixed(2)}
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-2">
            <p className="text-[10px] text-slate-400 font-medium">Savings</p>
            <p className="font-extrabold text-emerald-400 mt-0.5">
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
