import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { AgentEngagementData } from '@/components/transactions/agent-engagement/types'
import { StandaloneSearchBox } from '@react-google-maps/api'
import { useGoogleMaps } from '@/components/maps/GoogleMapsProvider'

interface SellerInformationFormProps {
  formData: AgentEngagementData
  onChange: (updates: Partial<AgentEngagementData>) => void
  onNext: () => void
  onBack: () => void
}

export function SellerInformationForm({ 
  formData, 
  onChange, 
  onNext, 
  onBack 
}: SellerInformationFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null)
  const { isLoaded } = useGoogleMaps()

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.sellerName) {
      newErrors.sellerName = 'Seller name is required'
    }
    if (!formData.sellerAddress) {
      newErrors.sellerAddress = 'Seller address is required'
    }
    if (!formData.sellerPhone) {
      newErrors.sellerPhone = 'Seller phone is required'
    }
    if (!formData.sellerEmail) {
      newErrors.sellerEmail = 'Seller email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.sellerEmail)) {
      newErrors.sellerEmail = 'Please enter a valid email'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validate()) {
      onNext()
    }
  }

  const handlePlaceSelect = () => {
    if (searchBox) {
      const places = searchBox.getPlaces()
      if (places && places.length > 0) {
        const place = places[0]
        onChange({ sellerAddress: place.formatted_address || '' })
      }
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      {/* Copy full JSX implementation */}
    </div>
  )
} 