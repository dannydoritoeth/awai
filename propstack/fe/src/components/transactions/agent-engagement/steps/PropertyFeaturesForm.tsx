import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { InfoIcon } from 'lucide-react'
import { Form6Data } from '../types'

interface PropertyFeaturesFormProps {
  formData: Form6Data
  onChange: (updates: Partial<Form6Data>) => void
  onNext: () => void
  onBack: () => void
}

export function PropertyFeaturesForm({ 
  formData, 
  onChange, 
  onNext, 
  onBack 
}: PropertyFeaturesFormProps) {
  // Copy implementation from form6 version
} 