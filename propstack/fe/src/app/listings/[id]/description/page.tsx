"use client"

import { useEffect, useState, use } from 'react'
import { Header } from '@/components/layout/Header'
import { PageHeading } from '@/components/layout/PageHeading'
import { DescriptionGenerator } from '@/components/listings/description/DescriptionGenerator'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/Spinner'

interface DescriptionPageProps {
  params: Promise<{
    id: string
  }>
}

export default function DescriptionPage({ params }: DescriptionPageProps) {
  const { id } = use(params)
  const [listing, setListing] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchListing = async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching listing:', error)
        router.push('/listings')
        return
      }

      setListing(data)
      setLoading(false)
    }

    fetchListing()
  }, [id, router])

  if (loading) return <Spinner />

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4">
        <PageHeading 
          title="Generate Description"
          description="Customize and generate descriptions for your listing"
          backHref={`/listings/${id}`}
          showBackButton
        />
        
        <div className="mt-8">
          <DescriptionGenerator 
            listing={listing}
            onComplete={() => router.push(`/listings/${id}`)}
          />
        </div>
      </main>
    </div>
  )
} 