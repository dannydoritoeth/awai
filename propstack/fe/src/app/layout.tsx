import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '@/contexts/AuthContext'
import { MapsProvider } from '@/contexts/MapsContext'
import { Toaster } from 'react-hot-toast'
import { AuthReturnHandler } from '@/components/auth/AuthReturnHandler'
import { Sidebar } from '@/components/layout/Sidebar'

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
          <MapsProvider>
            <div className="flex">
              <Sidebar />
              <div className="flex-1">
                {children}
              </div>
            </div>
            <AuthReturnHandler />
          </MapsProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  )
}
