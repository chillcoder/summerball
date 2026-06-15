import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { PostHogProvider, PostHogPageView } from "@/lib/posthog/provider";
import { Suspense } from "react";
import QueryProvider from "@/components/layout/QueryProvider";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Summer Ball",
  description: "Softball stats tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Summer Ball",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.variable} font-sans antialiased bg-background text-foreground`}>
        <PostHogProvider>
          <QueryProvider>
            <Suspense>
              <PostHogPageView />
            </Suspense>
            {children}
            <Toaster position="top-center" />
          </QueryProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
