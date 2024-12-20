interface ListingSummaryProps {
  listing: {
    address: string
    unitNumber?: string
    unit_number?: string
    propertyType?: string
    property_type?: string
    listingType?: string
    listing_type?: string
    price?: string | number
    currency?: string
    bedrooms?: number
    bathrooms?: number
    parking?: string
    lotSize?: string
    lot_size?: string
    lotSizeUnit?: string
    interiorSize?: string
    interior_size?: string
    highlights?: string[]
    otherDetails?: string
    other_details?: string
  }
}

export function ListingSummary({ listing }: ListingSummaryProps) {
  const formatHighlights = (highlights: string[] = []) => {
    if (highlights.length === 0) return 'None selected'
    return highlights.join(', ')
  }

  const address = listing.address
  const unitNumber = listing.unitNumber || listing.unit_number
  const propertyType = listing.propertyType || listing.property_type
  const listingType = listing.listingType || listing.listing_type
  const lotSize = listing.lotSize || listing.lot_size
  const interiorSize = listing.interiorSize || listing.interior_size
  const otherDetails = listing.otherDetails || listing.other_details

  return (
    <div className="space-y-4 text-gray-700">
      <div>
        <span className="font-medium">Address:</span>{' '}
        {address}
        {unitNumber && ` Unit ${unitNumber}`}
      </div>
      <div>
        <span className="font-medium">Type:</span>{' '}
        {propertyType?.charAt(0).toUpperCase() + propertyType?.slice(1)} for {listingType}
      </div>
      {listing.price && (
        <div>
          <span className="font-medium">Price:</span> {listing.price}
        </div>
      )}
      {listing.bedrooms && (
        <div>
          <span className="font-medium">Bedrooms:</span> {listing.bedrooms}
        </div>
      )}
      {listing.bathrooms && (
        <div>
          <span className="font-medium">Bathrooms:</span> {listing.bathrooms}
        </div>
      )}
      {listing.parking && (
        <div>
          <span className="font-medium">Parking:</span> {listing.parking}
        </div>
      )}
      {lotSize && (
        <div>
          <span className="font-medium">Lot Size:</span> {lotSize}
        </div>
      )}
      {interiorSize && (
        <div>
          <span className="font-medium">Interior Size:</span> {interiorSize}
        </div>
      )}
      {listing.highlights && (
        <div>
          <span className="font-medium">Property Highlights:</span>{' '}
          {formatHighlights(listing.highlights)}
        </div>
      )}
      {otherDetails && (
        <div>
          <span className="font-medium">Other Details:</span>{' '}
          {otherDetails}
        </div>
      )}
    </div>
  )
} 