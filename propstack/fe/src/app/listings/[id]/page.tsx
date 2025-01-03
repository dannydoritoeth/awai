import { ListingDetailPage } from '@/components/listings/ListingDetailPage'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ListingPage({ params }: PageProps) {
  const { id } = await params
  
  return (
    <div className="h-full">
      <ListingDetailPage id={id} />
    </div>
  )
} 