"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BasicPropertyForm } from './steps/BasicPropertyForm'
import { PropertyFeaturesForm } from './steps/PropertyFeaturesForm'
import { HighlightsForm } from './steps/HighlightsForm'
import { ReviewForm } from './steps/ReviewForm'
import { StepIndicator } from '@/components/ui/StepIndicator'

const steps = [
  'Basic Details',
  'Property Features',
  'Highlights',
  'Review'
]

const initialFormData = {
  address: '',
  latitude: null,
  longitude: null,
  propertyType: '',
  listingType: '',
  price: '',
  currency: '$',
  bedrooms: '',
  bathrooms: '',
  parking: '',
  lotSize: '',
  lotSizeUnit: 'sqm',
  interiorSize: '',
  interiorSizeUnit: 'sqm',
  highlights: [],
  otherDetails: '',
  // Location Features fields
  locationFeatures: [],
  nearbyAttractions: '',
  publicTransport: '',
  schools: '',
  shopping: '',
  neighborhood: ''
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
          ...formData
        }])

      if (error) throw error

      router.push('/listings')
    } catch (err) {
      console.error('Error creating listing:', err)
      setError(err instanceof Error ? err.message : 'Failed to create listing')
    } finally {
      setLoading(false)
    }
  }

  const handleFormUpdate = (updates: Partial<typeof initialFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
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
          <BasicPropertyForm
            data={formData}
            onUpdate={handleFormUpdate}
            onNext={handleNext}
          />
        )}
        {step === 2 && (
          <PropertyFeaturesForm
            data={formData}
            onUpdate={handleFormUpdate}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {step === 3 && (
          <HighlightsForm
            data={formData}
            onUpdate={handleFormUpdate}
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