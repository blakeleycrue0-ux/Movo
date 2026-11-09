import type { Metadata, Viewport } from "next";
import { Fredoka, Figtree } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/app-context";
import { Toaster } from "@/components/ui/kit";
import { t } from "@/i18n";

const display = Fredoka({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-display-face", display: "swap" });
const body = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: t.meta.title, template: `%s · ${t.meta.title}` },
  description: t.meta.description,
  applicationName: "Movo",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Movo" },
};

export const viewport: Viewport = {
  themeColor: "#f5f5f7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh">
        <AppProvider>
          {children}
          <Toaster />
        </AppProvider>
      </body>
    </html>
  );
}
