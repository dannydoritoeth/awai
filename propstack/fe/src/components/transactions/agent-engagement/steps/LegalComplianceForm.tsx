import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { InfoIcon } from 'lucide-react'
import { AgentEngagementData } from '../types'

interface LegalComplianceFormProps {
  formData: AgentEngagementData
  onChange: (updates: Partial<AgentEngagementData>) => void
  onNext: () => void
  onBack: () => void
}

export function LegalComplianceForm({ 
  formData, 
  onChange, 
  onNext, 
  onBack 
}: LegalComplianceFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (formData.commission < 0) {
      newErrors.commission = 'Commission cannot be negative'
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