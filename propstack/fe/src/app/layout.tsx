import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '@/contexts/AuthContext'
import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "PropStack IO",
  description: "AI-powered real estate platform",
};

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-white">
        <AuthProvider>
          <GoogleMapsProvider>
            {children}
          </GoogleMapsProvider>
        </AuthProvider>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            success: {
              style: {
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
              },
            },
            error: {
              style: {
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
              },
            },
          }}
        />
      </body>
    </html>
  )
}
