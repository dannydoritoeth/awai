interface StepIndicatorProps {
  steps: string[]
  currentStep: number
  className?: string
}

export function StepIndicator({ steps, currentStep, className = '' }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress" className={className}>
      <ol role="list" className="flex items-center">
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const isCurrentStep = currentStep === stepNumber
          const isPreviousStep = currentStep > stepNumber
          const isLastStep = index === steps.length - 1

          return (
            <li key={step} className={`relative ${!isLastStep ? 'pr-8 sm:pr-20' : ''} ${isPreviousStep ? 'shrink-0' : ''}`}>
              <div className="flex items-center">
                <div
                  className={`relative flex h-8 w-8 items-center justify-center rounded-full
                    ${isCurrentStep ? 'border-2 border-blue-600 bg-white' : 
                      isPreviousStep ? 'bg-blue-600' : 'border-2 border-gray-300 bg-white'}`}
                >
                  {isPreviousStep ? (
                    <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span
                      className={`text-sm font-medium
                        ${isCurrentStep ? 'text-blue-600' : 'text-gray-500'}`}
                    >
                      {stepNumber}
                    </span>
                  )}
                </div>
                {!isLastStep && (
                  <div className={`absolute left-8 top-4 -ml-px h-0.5 w-8 sm:w-20
                    ${isPreviousStep ? 'bg-blue-600' : 'bg-gray-300'}`}
                  />
                )}
              </div>
              <span className="absolute left-1/2 top-10 -translate-x-1/2 whitespace-nowrap text-sm font-medium text-gray-500">
                {step}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
} 