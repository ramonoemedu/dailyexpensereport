import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/css/satoshi.css";
import "flatpickr/dist/flatpickr.min.css";
import "jsvectormap/dist/jsvectormap.css";
import { ThemeProviderWrapper } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { NextAdminProviders } from "@/components/NextAdmin/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Daily Expense Report",
  description: "Daily Expense Tracking System",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <NextAdminProviders>
          <ThemeProviderWrapper>
            <AuthProvider>
              {children}
            </AuthProvider>
          </ThemeProviderWrapper>
        </NextAdminProviders>
      </body>
    </html>
  );
}