import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { Form6Data } from '../types'

interface ReviewFormProps {
  formData: Form6Data
  onSubmit: () => void
  onBack: () => void
}

export function ReviewForm({ 
  formData, 
  onSubmit, 
  onBack 
}: ReviewFormProps) {
  // Copy implementation from form6 version
} 