interface StepIndicatorProps {
  steps: string[]
  currentStep: number
  className?: string
}

export function StepIndicator({ steps, currentStep, className = '' }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress" className={className}>
      <ol className="flex items-center justify-between w-full">
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const isCurrentStep = currentStep === stepNumber
          const isPreviousStep = currentStep > stepNumber
          const isLastStep = index === steps.length - 1

          return (
            <li key={step} className="flex flex-col items-center relative flex-1">
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
                  <div 
                    className={`h-0.5 w-full
                      ${isPreviousStep ? 'bg-blue-600' : 'bg-gray-300'}`}
                    style={{ width: 'calc(100% - 2rem)' }}
                  />
                )}
              </div>
              <span className="mt-2 text-sm font-medium text-gray-500 text-center">
                {step}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
} 