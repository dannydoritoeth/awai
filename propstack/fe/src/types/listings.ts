export interface Listing {
  id: string
  address: string
  bedrooms: number
  bathrooms: number
  created_at: string
  status: 'draft' | 'published' | 'archived'
  description: string
} 