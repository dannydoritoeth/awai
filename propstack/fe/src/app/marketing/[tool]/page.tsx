"use client"

import { Header } from '@/components/layout/Header'
import { PageTransition } from '@/components/layout/PageTransition'

export default function ToolPage({ params }: { params: { tool: string } }) {
  const titles = {
    descriptions: 'Generate Listing Descriptions',
    images: 'Enhance Images & Captions',
    social: 'Create Social Media Content',
    email: 'Email Campaign Generator'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <PageTransition showBackButton>
        <main className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {titles[params.tool as keyof typeof titles]}
          </h1>
          {/* Tool specific content here */}
        </main>
      </PageTransition>
    </div>
  )
} 