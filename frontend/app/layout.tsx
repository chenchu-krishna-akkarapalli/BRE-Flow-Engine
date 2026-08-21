import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";
import { Sidebar } from "@/components/Sidebar";

const outfit = Outfit({ 
  variable: "--font-outfit", 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"]
});

const inter = Inter({ 
  variable: "--font-inter", 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"]
});

const jetbrainsMono = JetBrains_Mono({ 
  variable: "--font-jetbrains", 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "FlowBRE — Multi-Bank Rule Engine & Loan Portal",
  description: "Next-gen instant loan eligibility engine and telemetry matrix across 8 partner banks.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex h-screen w-screen overflow-hidden bg-bg-deep text-ink selection:bg-brand-500/20 selection:text-brand-600">
        <div className="relative flex h-full w-full overflow-hidden">
          {/* Subtle Ambient Light Backdrop Glows */}
          <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-brand-500/5 blur-[140px]" />
          <div className="pointer-events-none absolute top-1/3 -right-40 -z-10 h-[500px] w-[500px] rounded-full bg-brand-indigo/5 blur-[130px]" />
          
          {/* Persistent Fixed Desktop Sidebar (xl) & Slide-out Drawer (< xl) */}
          <Sidebar />

          {/* Main Workspace Panel Guard: min-w-0 flex-1 flex flex-col overflow-hidden */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden h-full">
            <AppHeader />
            <main className="flex-1 overflow-y-auto min-w-0 flex flex-col">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
