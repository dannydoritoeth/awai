"use client"

import { Header } from '@/components/layout/Header'


export default function ToolPage({ params }: { params: { tool: string } }) {
  const titles = {
    descriptions: 'Listing Descriptions',
    images: 'Enhance Images & Captions',
    social: 'Create Social Media Content',
    email: 'Email Campaign Generator'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
        <main className="container mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {titles[params.tool as keyof typeof titles]}
          </h1>
          {/* Tool specific content here */}
        </main>
    </div>
  )
} 