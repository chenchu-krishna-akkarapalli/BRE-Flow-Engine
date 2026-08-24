import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { PortalShell } from "@/components/PortalShell";

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
        <PortalShell>{children}</PortalShell>
      </body>
    </html>
  );
}
