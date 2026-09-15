import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Print Infinity | Fast & Private Cloud Printing",
  description: "Upload your documents, choose print settings, pay securely, and print instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
