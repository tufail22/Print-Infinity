import React from "react";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center max-w-4xl mx-auto">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 mb-6">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        Print Infinity Scaffolding Ready
      </div>

      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
        Print Infinity Customer Portal
      </h1>

      <p className="text-lg text-slate-600 max-w-2xl mb-10">
        Scan in-store QR code, upload documents, configure print settings, pay via Cash or UPI, and submit.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full text-left">
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="text-indigo-600 font-bold text-lg mb-2">1. Upload & Settings</div>
          <p className="text-sm text-slate-500">
            Document upload (PDF, DOCX, images), copies, color vs. B&amp;W, duplexing, and page range selections.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="text-indigo-600 font-bold text-lg mb-2">2. Pay via Cash or UPI</div>
          <p className="text-sm text-slate-500">
            Select counter cash payment or instant UPI QR code transaction with live status feedback.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="text-indigo-600 font-bold text-lg mb-2">3. Zero-Disk Streaming</div>
          <p className="text-sm text-slate-500">
            Storekeeper approves in the Windows App, streaming directly to printer with zero disk storage.
          </p>
        </div>
      </div>
    </main>
  );
}
