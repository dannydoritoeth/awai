"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PropertyDetailsForm } from './steps/PropertyDetailsForm'
import { LocationDetailsForm } from './steps/LocationDetailsForm'
import { FeaturesForm } from './steps/FeaturesForm'
import { ReviewForm } from './steps/ReviewForm'
import { StepIndicator } from '@/components/ui/StepIndicator'

const steps = [
  'Property Details',
  'Location',
  'Features',
  'Review'
]

interface ListingFormData {
  address: string
  propertyType: string
  listingType: string
  price: string
  suburb: string
  state: string
  postcode: string
  locationDescription: string
  bedrooms: string
  bathrooms: string
  parking: string
  description: string
}

const initialFormData: ListingFormData = {
  address: '',
  propertyType: '',
  listingType: '',
  price: '',
  suburb: '',
  state: '',
  postcode: '',
  locationDescription: '',
  bedrooms: '',
  bathrooms: '',
  parking: '',
  description: ''
}

export function ListingWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState(initialFormData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleNext = () => {
    setStep(step + 1)
  }

  const handleBack = () => {
    setStep(step - 1)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/signin')
        return
      }

      const { error } = await supabase
        .from('listings')
        .insert([{
          user_id: user.id,
          // ... transform formData to database format
        }])

      if (error) throw error

      router.push('/marketing/descriptions')
    } catch (err) {
      console.error('Error creating listing:', err)
      setError(err instanceof Error ? err.message : 'Failed to create listing')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <StepIndicator 
        steps={steps}
        currentStep={step}
        className="mb-8"
      />

      <div className="bg-white rounded-lg shadow-sm">
        {step === 1 && (
          <PropertyDetailsForm
            data={formData}
            onUpdate={setFormData}
            onNext={handleNext}
          />
        )}
        {step === 2 && (
          <LocationDetailsForm
            data={formData}
            onUpdate={setFormData}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {step === 3 && (
          <FeaturesForm
            data={formData}
            onUpdate={setFormData}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {step === 4 && (
          <ReviewForm
            data={formData}
            onSubmit={handleSubmit}
            onBack={handleBack}
            loading={loading}
          />
        )}

        {error && (
          <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-md mt-4">
            {error}
          </div>
        )}
      </div>
    </div>
  )
} 