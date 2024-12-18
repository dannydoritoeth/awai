export interface ListingFormData {
  address: string
  unitNumber?: string
  listingType: 'sale' | 'rent' | ''
  propertyType: 'house' | 'condo' | 'vacant-land' | 'multi-family' | 'townhouse' | 'other' | ''
  price?: string
  bedrooms?: string
  bathrooms?: string
  parking?: string
  lotSize?: string
  lotSizeUnit?: 'sqft' | 'acres'
  interiorSize?: string
  highlights: string[]
  otherDetails?: string
  fullAddress?: google.maps.places.PlaceResult
} 