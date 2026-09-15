import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Print Infinity | Instant QR Print Portal",
  description:
    "Upload your documents, customize print settings, pay securely via UPI or cash, and stream straight to local print shop hardware with zero disk storage.",
  openGraph: {
    title: "Print Infinity — Private Cloud-to-Printer",
    description: "Scan, upload, pay, and print instantly with zero disk persistence.",
    type: "website",
  },
};

export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-slate-50/60 font-sans">{children}</div>;
}
