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
    <html lang="en" className="h-full">
      <body className={`${inter.variable} font-sans h-full text-gray-900 bg-gray-50`}>
        <AuthProvider>
          <MapsProvider>
            <div className="flex h-full">
              <Sidebar />
              <main className="flex-1 overflow-y-auto">
                {children}
              </main>
            </div>
            <AuthReturnHandler />
          </MapsProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  )
}
