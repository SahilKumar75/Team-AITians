import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Swasthya Sanchar",
  description: "Decentralised Medical Records — Patient-sovereign, blockchain-anchored.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
