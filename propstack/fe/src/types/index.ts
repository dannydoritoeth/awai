export interface ListingFormData {
  address: string
  unitNumber?: string
  propertyType: string
  listingType: string
  price?: string
  currency?: '€' | '£' | '$'
  bedrooms?: number
  bathrooms?: number
  parking?: string
  lotSize?: string
  lotSizeUnit?: 'sq m' | 'sq ft' | 'acres' | 'hectares'
  interiorSize?: string
  interiorSizeUnit?: 'sq m' | 'sq ft'
  highlights: string[]
  otherDetails?: string
}

export interface Listing extends Omit<ListingFormData, 
  'price' | 'lotSize' | 'interiorSize'> {
  id: string
  user_id: string
  price?: string        // Stored as "€600,000"
  lot_size?: string     // Stored as "3000 sq m"
  interior_size?: string // Stored as "200 sq m"
  created_at: string
} 