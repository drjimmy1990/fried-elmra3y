import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'لوحة تحكم مطعم الخديوي | Operations Dashboard',
  description: 'نظام إدارة البوت والأوردرات والشكاوى والمنيو لمطعم الخديوي',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
