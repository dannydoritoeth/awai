import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { GoogleAnalytics } from '@/components/common/GoogleAnalytics';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Accelerate with AI',
  description: 'We help businesses leverage AI to grow and save costs through intelligent automation solutions.',
  icons: {
    icon: [
      { url: '/assets/logos/awai-icon-white.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/assets/logos/awai-icon-white.svg',
    apple: '/assets/logos/awai-icon-white.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <GoogleAnalytics />
        {children}
        <Footer />
      </body>
    </html>
  );
}