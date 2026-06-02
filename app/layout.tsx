import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "P2 Digital Check",
  description: "Internes Website-Analyse-Tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
