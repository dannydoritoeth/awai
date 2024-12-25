"use client"

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PropertyDetailsForm } from '@/components/listings/steps/PropertyDetailsForm'
import { LocationDetailsForm } from '@/components/listings/steps/LocationDetailsForm'
import { FeaturesForm } from '@/components/listings/steps/FeaturesForm'
import { ReviewForm } from '@/components/listings/steps/ReviewForm'
import { StepIndicator } from '@/components/ui/StepIndicator'

export function ListingWizard() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({})
  const [error, setError] = useState<string | null>(null)

  const handleFormUpdate = useCallback((data: any) => {
    console.log('Form data updated:', data)
    setFormData(prev => ({ ...prev, ...data }))
  }, [])

  const handleSubmit = async () => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .insert([formData])
        .select()
        .single()

      if (error) throw error

      router.push('/listings')
    } catch (err) {
      console.error('Error creating listing:', err)
      setError('Failed to create listing')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <StepIndicator
        steps={["Property Details", "Location", "Features", "Review"]}
        currentStep={currentStep}
        className="mb-8"
      />

      {currentStep === 1 && (
        <PropertyDetailsForm
          data={formData}
          onUpdate={handleFormUpdate}
          onNext={() => setCurrentStep(2)}
        />
      )}

      {currentStep === 2 && (
        <LocationDetailsForm
          data={formData}
          onUpdate={handleFormUpdate}
          onNext={() => setCurrentStep(3)}
          onBack={() => setCurrentStep(1)}
        />
      )}

      {currentStep === 3 && (
        <FeaturesForm
          data={formData}
          onUpdate={handleFormUpdate}
          onNext={() => setCurrentStep(4)}
          onBack={() => setCurrentStep(2)}
        />
      )}

      {currentStep === 4 && (
        <ReviewForm
          data={formData}
          onBack={() => setCurrentStep(3)}
          onSubmit={handleSubmit}
        />
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-md">
          {error}
        </div>
      )}
    </div>
  )
} 