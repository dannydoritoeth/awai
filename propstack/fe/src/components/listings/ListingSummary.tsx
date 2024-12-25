interface ListingSummaryProps {
  listing: {
    address: string
    unitNumber?: string
    propertyType: string
    listingType: string
    price?: string
    currency?: string
    bedrooms?: number
    bathrooms?: number
    parking?: string
    lotSize?: string
    interiorSize?: string
    highlights?: string[]
    otherDetails?: string
  }
}

export function ListingSummary({ listing }: ListingSummaryProps) {
  // Helper function to capitalize first letter
  const capitalize = (str: string) => {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  };

  return (
    <div className="space-y-4 text-gray-700">
      <div>
        <span className="font-medium">Address:</span>{' '}
        {listing.address}
        {listing.unitNumber && ` Unit ${listing.unitNumber}`}
      </div>
      {listing.propertyType && listing.listingType && (
        <div>
          <span className="font-medium">Type:</span>{' '}
          {capitalize(listing.propertyType)} for {listing.listingType}
        </div>
      )}
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
      {listing.lotSize && (
        <div>
          <span className="font-medium">Lot Size:</span> {listing.lotSize}
        </div>
      )}
      {listing.interiorSize && (
        <div>
          <span className="font-medium">Interior Size:</span> {listing.interiorSize}
        </div>
      )}
      {listing.highlights && listing.highlights.length > 0 && (
        <div>
          <span className="font-medium">Property Highlights:</span>{' '}
          {listing.highlights.join(', ')}
        </div>
      )}
      {listing.otherDetails && (
        <div>
          <span className="font-medium">Other Details:</span>{' '}
          {listing.otherDetails}
        </div>
      )}
    </div>
  )
} 