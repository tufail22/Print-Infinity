"use client";

import React, { useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Trash2,
  AlertCircle,
  FileCheck2,
  Sparkles,
  Layers,
  CheckCircle,
  FilePlus,
} from "lucide-react";
import { UploadedFileItem } from "@/types/printJob";
import { getPdfPageCount } from "@/lib/pdfUtils";
import { compressImageIfNeeded } from "@/lib/imageCompressor";

interface UploadZoneProps {
  files: UploadedFileItem[];
  onFilesChange: (files: UploadedFileItem[]) => void;
  isUploading?: boolean;
}

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB cap
const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".rtf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
];

export const UploadZone: React.FC<UploadZoneProps> = ({
  files,
  onFilesChange,
  isUploading = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processSelectedFiles = async (rawFiles: FileList | File[]) => {
    setErrorMessage(null);
    setIsProcessing(true);

    const newItems: UploadedFileItem[] = [];

    for (let i = 0; i < rawFiles.length; i++) {
      let file = rawFiles[i];
      const lowerName = file.name.toLowerCase();
      const ext = lowerName.substring(lowerName.lastIndexOf("."));

      // Validate Extension
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setErrorMessage(
          `Unsupported file "${file.name}". Please upload PDF, Word (.docx), PPT, or Images.`
        );
        continue;
      }

      // Validate 100MB size limit
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage(`"${file.name}" exceeds the 100MB limit. Please select a smaller file.`);
        continue;
      }

      // Compress raster images if above ~2MB
      let isCompressed = false;
      if (file.type.startsWith("image/") && file.size > 2 * 1024 * 1024) {
        const compressed = await compressImageIfNeeded(file);
        if (compressed.size < file.size) {
          file = compressed;
          isCompressed = true;
        }
      }

      // Determine page count
      let pages = 1;
      if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
        pages = await getPdfPageCount(file);
      }

      // Preview URL for images
      let previewUrl: string | undefined = undefined;
      if (file.type.startsWith("image/")) {
        previewUrl = URL.createObjectURL(file);
      }

      newItems.push({
        id: "file_" + Math.random().toString(36).substring(2) + "_" + Date.now(),
        file,
        name: file.name,
        sizeBytes: file.size,
        formattedSize: formatBytes(file.size),
        type: file.type || ext,
        totalPages: pages,
        previewUrl,
        uploadProgress: 0,
        isCompressed,
      });
    }

    setIsProcessing(false);
    if (newItems.length > 0) {
      onFilesChange([...files, ...newItems]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processSelectedFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processSelectedFiles(e.target.files);
      e.target.value = "";
    }
  };

  const removeFile = (id: string) => {
    const updated = files.filter((f) => f.id !== id);
    onFilesChange(updated);
  };

  const getFileIcon = (fileItem: UploadedFileItem) => {
    if (fileItem.type.startsWith("image/")) {
      return <ImageIcon className="w-5 h-5 text-sky-500" />;
    }
    if (fileItem.name.endsWith(".ppt") || fileItem.name.endsWith(".pptx")) {
      return <FileSpreadsheet className="w-5 h-5 text-amber-500" />;
    }
    return <FileText className="w-5 h-5 text-indigo-600" />;
  };

  return (
    <div className="w-full space-y-4">
      {/* Premium Glassmorphic Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        tabIndex={0}
        role="button"
        aria-label="Upload document to print. Tap or drag files here."
        className={`relative overflow-hidden cursor-pointer rounded-3xl p-7 text-center transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-indigo-100 ${
          isDragOver
            ? "border-2 border-dashed border-indigo-500 bg-indigo-50/80 scale-[1.01] shadow-lg shadow-indigo-500/10"
            : "glass-panel hover:bg-white/95 border-2 border-dashed border-indigo-200/80 hover:border-indigo-400"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.txt"
          onChange={handleInputChange}
          className="hidden"
          aria-hidden="true"
        />

        <div className="flex flex-col items-center justify-center space-y-3.5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500/10 via-sky-500/10 to-amber-500/10 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner group-hover:scale-110 transition-transform">
            {isProcessing ? (
              <Sparkles className="w-8 h-8 animate-spin text-indigo-500" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
          </div>

          <div>
            <p className="text-base font-extrabold text-slate-800 tracking-tight">
              {isDragOver ? "Drop documents to upload" : "Tap or Drag files to print"}
            </p>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              PDF, Word, PowerPoint, Images (Max 100MB per file)
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/90 text-slate-700 text-xs font-bold border border-slate-200/60 shadow-xs">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Multiple files supported</span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50/90 border border-rose-200 text-rose-800 text-xs shadow-sm animate-shake">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <p className="flex-1 font-medium">{errorMessage}</p>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-700 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Uploaded File List */}
      {files.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-600 font-bold px-1">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>DOCUMENTS ATTACHED ({files.length})</span>
            </span>
            <span className="text-indigo-700">
              Total Pages: {files.reduce((sum, f) => sum + f.totalPages, 0)}
            </span>
          </div>

          {files.map((item) => (
            <div
              key={item.id}
              className="glass-panel group relative flex items-center gap-3 p-3.5 rounded-2xl border border-white/90 shadow-sm hover:border-indigo-200 transition-all"
            >
              {/* Thumbnail / Icon */}
              {item.previewUrl ? (
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 shadow-xs">
                  <img
                    src={item.previewUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-indigo-50/80 border border-indigo-100 flex items-center justify-center flex-shrink-0 shadow-xs">
                  {getFileIcon(item)}
                </div>
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {item.name}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                    <FileCheck2 className="w-3 h-3 text-indigo-600" />
                    {item.totalPages} {item.totalPages === 1 ? "page" : "pages"}
                  </span>
                  <span>•</span>
                  <span>{item.formattedSize}</span>
                  {item.isCompressed && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                      Compressed
                    </span>
                  )}
                </div>
              </div>

              {/* Remove button */}
              {!isUploading && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(item.id);
                  }}
                  aria-label={`Remove ${item.name}`}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Upload Progress Overlay */}
              {isUploading && item.uploadProgress < 100 && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-100 rounded-b-2xl overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-sky-500 transition-all duration-300"
                    style={{ width: `${item.uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          ))}

          {/* Add more button */}
          {!isUploading && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-3 rounded-xl border border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50/50 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <FilePlus className="w-4 h-4" />
              <span>Add Another Document</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
