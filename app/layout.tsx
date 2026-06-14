import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ClientToaster } from "@/components/ui/client-toaster";
import { DocumentProvider } from "@/lib/context/document-context";
import { LayoutProvider } from "@/lib/context/layout-context";
import { CategoryProvider } from "@/lib/context/category-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NoteMD",
  description: "A clean, minimal markdown writing experience",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DocumentProvider>
          <LayoutProvider>
            <CategoryProvider>
              {children}
            </CategoryProvider>
          </LayoutProvider>
        </DocumentProvider>
        <ClientToaster />
      </body>
    </html>
  );
}
