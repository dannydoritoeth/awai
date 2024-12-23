import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { InfoIcon } from 'lucide-react'
import { AgentEngagementData } from '../types'
import { StandaloneSearchBox } from '@react-google-maps/api'
import { useGoogleMaps } from '@/components/maps/GoogleMapsProvider'

interface PropertyDetailsFormProps {
  formData: AgentEngagementData
  onChange: (updates: Partial<AgentEngagementData>) => void
  onNext: () => void
  onBack: () => void
}

export function PropertyDetailsForm({ 
  formData, 
  onChange, 
  onNext, 
  onBack 
}: PropertyDetailsFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null)
  const { isLoaded } = useGoogleMaps()

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.propertyAddress) {
      newErrors.propertyAddress = 'Property address is required'
    }
    if (!formData.titleReference) {
      newErrors.titleReference = 'Title reference is required'
    }
    if (!formData.spNumber) {
      newErrors.spNumber = 'SP number is required'
    }
    if (formData.saleMethod === 'private' && !formData.listPrice) {
      newErrors.listPrice = 'List price is required for private sale'
    }
    if (formData.saleMethod === 'auction') {
      if (!formData.auctionDetails?.date) {
        newErrors.auctionDate = 'Auction date is required'
      }
      if (!formData.auctionDetails?.time) {
        newErrors.auctionTime = 'Auction time is required'
      }
      if (!formData.auctionDetails?.venue) {
        newErrors.auctionVenue = 'Auction venue is required'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ... rest of the implementation from form6 version
  return (
    // ... JSX from form6 version
  )
} 