"use client"

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'

import { PageHeading } from '@/components/layout/PageHeading'
import { AgentEngagementWizard } from '@/components/transactions/agent-engagement/AgentEngagementWizard'
import { useSearchParams } from 'next/navigation'
import { use } from 'react'
import { getEngagement } from '@/services/engagements'
import { Spinner } from '@/components/ui/Spinner'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default function AgentEngagementDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const isNew = searchParams.get('new') === 'true'
  const [loading, setLoading] = useState(true)
  const [exists, setExists] = useState(false)

  useEffect(() => {
    async function checkEngagement() {
      try {
        const engagement = await getEngagement(id)
        if (!engagement) {
          notFound()
        }
        setExists(true)
      } catch (error) {
        console.error('Error checking engagement:', error)
        notFound()
      } finally {
        setLoading(false)
      }
    }
    checkEngagement()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        
          <main className="container mx-auto px-4 py-8">
            <div className="flex justify-center items-center min-h-[400px]">
              <Spinner />
            </div>
          </main>
        
      </div>
    )
  }

  if (!exists) {
    return notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
        <main className="container mx-auto px-4">
          <PageHeading 
            title="Agent Engagement" 
            description="View and edit agent engagement details"
            backHref="/transactions/agent-engagement"
            showBackButton
          />
          
          {isNew && (
            <div className="mb-6 bg-green-50 text-green-800 p-4 rounded-md border border-green-200">
              Engagement successfully created! You can continue editing the details below.
            </div>
          )}

          <AgentEngagementWizard id={id} />
        </main>
      
    </div>
  )
} 