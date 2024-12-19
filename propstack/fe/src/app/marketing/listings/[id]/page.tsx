"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { ListingDetail } from '@/components/marketing/listings/ListingDetail'
import { supabase } from '@/lib/supabase'
import { use } from 'react'

// Add dynamic route configuration
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default function ListingPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/signin')
      }
    }
    checkAuth()
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <ListingDetail listingId={id} />
      </main>
    </div>
  )
} 