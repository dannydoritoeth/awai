import { Header } from '@/components/layout/Header'
import { ListingDetail } from '@/components/marketing/listings/ListingDetail'
import { createServerClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ListingDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!listing) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4">
        <ListingDetail listing={listing} />
      </main>
    </div>
  )
} 