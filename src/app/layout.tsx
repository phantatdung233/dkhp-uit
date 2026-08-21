import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = {
  title: "UIT - ĐKHP",
  description: "Ứng dụng giúp sinh viên UIT đăng ký học phần dễ dàng hơn",
  keywords: ["schedule", "planner", "university", "course", "registration", "timetable"],
  icons: {
    icon: "https://se.uit.edu.vn/images/Logo/Logo_CNPM.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        {children}
        <Toaster position="bottom-right" richColors closeButton duration={3000} />
        <Analytics />
      </body>
    </html>
  );
}
