import { ListingDetailPage } from '@/components/marketing/listings/ListingDetailPage'

interface PageProps {
  params: {
    id: string
  }
}

export default function ListingPage({ params }: PageProps) {
  return <ListingDetailPage id={params.id} />
} 