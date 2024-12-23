import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { InfoIcon } from 'lucide-react'
import { Form6Data } from '../types'

interface LegalComplianceFormProps {
  formData: Form6Data
  onChange: (updates: Partial<Form6Data>) => void
  onNext: () => void
  onBack: () => void
}

export function LegalComplianceForm({ 
  formData, 
  onChange, 
  onNext, 
  onBack 
}: LegalComplianceFormProps) {
  // Copy implementation from form6 version
} 