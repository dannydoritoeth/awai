"use client"

import { useState } from 'react'
import { AgentEngagementData } from '@/components/transactions/agent-engagement/types'
import { DeliveryDetailsForm } from '@/components/transactions/agent-engagement/steps/DeliveryDetailsForm'
import { SellerInformationForm } from '@/components/transactions/agent-engagement/steps/SellerInformationForm'
import { PropertyDetailsForm } from '@/components/transactions/agent-engagement/steps/PropertyDetailsForm'
import { PropertyFeaturesForm } from '@/components/transactions/agent-engagement/steps/PropertyFeaturesForm'
import { LegalComplianceForm } from '@/components/transactions/agent-engagement/steps/LegalComplianceForm'
import { ReviewForm } from '@/components/transactions/agent-engagement/steps/ReviewForm'
import { FormSteps } from '@/components/transactions/agent-engagement/FormSteps'

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
  titleReference: '',
  spNumber: '',
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
  sellerWarranties: 'na',
  heritageListed: 'na',
  contaminatedLand: 'na',
  environmentManagement: 'na',
  presentLandUse: 'na',
  neighbourhoodDisputes: false,
  encumbrances: false,
  gstApplicable: false,
  commission: 2.0,
  authorisedMarketing: false
}

const steps = [
  'Delivery Details',
  'Property Details',
  'Seller Information',
  'Property Features',
  'Legal & Compliance',
  'Review'
]

export function AgentEngagementWizard() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<AgentEngagementData>(initialFormData)

  const handleNext = () => {
    setStep(current => current + 1)
  }

  const handleBack = () => {
    setStep(current => current - 1)
  }

  const handleSubmit = async () => {
    // Handle form submission
    console.log('Form submitted:', formData)
  }

  const updateFormData = (updates: Partial<AgentEngagementData>) => {
    setFormData(current => ({ ...current, ...updates }))
  }

  return (
    <div className="max-w-4xl mx-auto">
      <FormSteps steps={steps} currentStep={step} />
      
      {/* Form Steps */}
      {step === 1 && (
        <DeliveryDetailsForm
          formData={formData}
          onChange={updateFormData}
          onNext={handleNext}
        />
      )}
      {step === 2 && (
        <PropertyDetailsForm
          formData={formData}
          onChange={updateFormData}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
      {step === 3 && (
        <SellerInformationForm
          formData={formData}
          onChange={updateFormData}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
      {step === 4 && (
        <PropertyFeaturesForm
          formData={formData}
          onChange={updateFormData}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
      {step === 5 && (
        <LegalComplianceForm
          formData={formData}
          onChange={updateFormData}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
      {step === 6 && (
        <ReviewForm
          formData={formData}
          onSubmit={handleSubmit}
          onBack={handleBack}
        />
      )}
    </div>
  )
} 