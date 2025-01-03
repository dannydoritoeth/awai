import { ListingDetailPage } from '@/components/listings/ListingDetailPage'

export default function ListingPage({ params }: { params: { id: string } }) {
  return (
    <div className="h-full">
      <ListingDetailPage id={params.id} />
    </div>
  )
} 