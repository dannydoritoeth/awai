import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { Form6Data } from '../types'
import { StandaloneSearchBox } from '@react-google-maps/api'
import { useGoogleMaps } from '@/components/maps/GoogleMapsProvider'

interface SellerInformationFormProps {
  formData: Form6Data
  onChange: (updates: Partial<Form6Data>) => void
  onNext: () => void
  onBack: () => void
}

export function SellerInformationForm({ 
  formData, 
  onChange, 
  onNext, 
  onBack 
}: SellerInformationFormProps) {
  // Copy implementation from form6 version
} 