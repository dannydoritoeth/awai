"use client"

import { useState, useEffect } from 'react'
import { AgentEngagementData } from '@/components/transactions/agent-engagement/types'
import { SellerInformationForm } from '@/components/transactions/agent-engagement/steps/SellerInformationForm'
import { PropertyDetailsForm } from '@/components/transactions/agent-engagement/steps/PropertyDetailsForm'
import { PropertyFeaturesForm } from '@/components/transactions/agent-engagement/steps/PropertyFeaturesForm'
import { LegalComplianceForm } from '@/components/transactions/agent-engagement/steps/LegalComplianceForm'
import { ReviewForm } from '@/components/transactions/agent-engagement/steps/ReviewForm'
import { FormSteps } from '@/components/transactions/agent-engagement/FormSteps'
import { createEngagement, updateEngagement, getEngagement } from '@/services/engagements'
import { useRouter } from 'next/navigation'
import { PostgrestError } from '@supabase/supabase-js'
import { useAuth } from '@/contexts/AuthContext'
import { EngagementAuthModal } from './EngagementAuthModal'

const initialFormData: AgentEngagementData = {
  // Delivery Details
  deliveryMethod: 'email',
  requiredDateTime: '',
  
  // Seller Details
  sellerName: '',
  sellerAddress: '',
  sellerPhone: '',
  sellerEmail: '',
  
  // Property Details
  propertyAddress: '',
  spNumber: '',
  surveyPlanNumber: '',
  titleReference: '',
  saleMethod: 'private',
  listPrice: '',
  
  // Property Features
  propertyType: 'house',
  bedrooms: 0,
  bathrooms: 0,
  carSpaces: 0,
  pool: false,
  bodyCorp: false,
  electricalSafetySwitch: false,
  smokeAlarms: false,
  adviceToMarketPrice: false,
  
  // Compliance & Legal
  sellerWarranties: '',
  heritageListed: '',
  contaminatedLand: '',
  environmentManagement: '',
  presentLandUse: '',
  neighbourhoodDisputes: '',
  encumbrances: '',
  gstApplicable: '',
  authorisedMarketing: '',
  commission: 2.0
}

const steps = [
  'Property Details',
  'Seller Information',
  'Property Features',
  'Legal & Compliance',
  'Review'
]

export function AgentEngagementWizard({ id }: { id?: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<AgentEngagementData>(initialFormData)

  useEffect(() => {
    if (id) {
      loadEngagement()
    }
  }, [id])

  async function loadEngagement() {
    try {
      setError(null)
      const data = await getEngagement(id!)
      setFormData({
        ...initialFormData,
        ...data
      })
    } catch (err) {
      const error = err as Error | PostgrestError
      console.error('Error loading engagement:', error)
      setError(error.message || 'Failed to load engagement')
    }
  }

  const handleNext = () => {
    setStep(s => Math.min(s + 1, steps.length))
  }

  const handleBack = () => {
    setStep(s => Math.max(s - 1, 1))
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    
    if (!user) {
      setShowAuthModal(true)
      setLoading(false)
      return
    }

    try {
      if (id) {
        await updateEngagement(id, formData)
      } else {
        await createEngagement(formData)
      }
      router.push('/transactions/agent-engagement')
    } catch (err) {
      const error = err as Error | PostgrestError
      console.error('Error saving engagement:', error)
      setError(error.message || 'Failed to save engagement')
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (updates: Partial<AgentEngagementData>) => {
    setFormData(current => ({ ...current, ...updates }))
  }

  const handleEditStep = (stepNumber: number) => {
    setStep(stepNumber)
  }

  return (
    <div className="space-y-8">
      <FormSteps steps={steps} currentStep={step} />
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Form Steps */}
      {step === 1 && (
        <PropertyDetailsForm
          formData={formData}
          onChange={updateFormData}
          onNext={handleNext}
          isFirstStep={true}
        />
      )}
      {step === 2 && (
        <SellerInformationForm
          formData={formData}
          onChange={updateFormData}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
      {step === 3 && (
        <PropertyFeaturesForm
          formData={formData}
          onChange={updateFormData}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
      {step === 4 && (
        <LegalComplianceForm
          formData={formData}
          onChange={updateFormData}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
      {step === 5 && (
        <ReviewForm
          formData={formData}
          onSubmit={handleSubmit}
          onBack={handleBack}
          onEditStep={handleEditStep}
        />
      )}

      {showAuthModal && (
        <EngagementAuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  )
} 