import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { InfoIcon } from 'lucide-react'
import { AgentEngagementData } from '@/components/transactions/agent-engagement/types'

interface PropertyFeaturesFormProps {
  formData: AgentEngagementData
  onChange: (updates: Partial<AgentEngagementData>) => void
  onNext: () => void
  onBack: () => void
}

export function PropertyFeaturesForm({ 
  formData, 
  onChange, 
  onNext, 
  onBack 
}: PropertyFeaturesFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (formData.bedrooms < 0) {
      newErrors.bedrooms = 'Bedrooms cannot be negative'
    }
    if (formData.bathrooms < 0) {
      newErrors.bathrooms = 'Bathrooms cannot be negative'
    }
    if (formData.carSpaces < 0) {
      newErrors.carSpaces = 'Car spaces cannot be negative'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validate()) {
      onNext()
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      {/* Copy full JSX implementation */}
    </div>
  )
} 