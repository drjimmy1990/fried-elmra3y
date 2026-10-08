import type { Metadata } from 'next';
import './globals.css';

// The restaurant name lives in bot_settings and can change, so metadata stays generic.
export const metadata: Metadata = {
  title: 'لوحة التحكم | الأوردرات والبوت',
  description: 'إدارة أوردرات وشكاوى ومحادثات وتعليقات مطعم الفرايد تشيكن والبوت',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
