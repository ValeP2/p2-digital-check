import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

// Dieselbe Schrift wie im Kompass
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: "P2 Digital Check",
  description: "Website-Analyse für Schweizer KMU",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de-CH" className={`${inter.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
