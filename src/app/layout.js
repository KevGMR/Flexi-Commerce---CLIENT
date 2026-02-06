import { Geist, Geist_Mono } from "next/font/google";
import { SessionInitializer } from "@/components/SessionInitializer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "FLEXI-POS Dashboard",
  description: "Multi-tenant commerce dashboard skeleton for FLEXI-POS",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SessionInitializer>{children}</SessionInitializer>
      </body>
    </html>
  );
}
