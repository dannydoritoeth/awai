import { CheckIcon } from '@heroicons/react/24/solid'

interface StepIndicatorProps {
  steps: string[]
  currentStep: number
  className?: string
}

export function StepIndicator({ steps, currentStep, className = '' }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress" className={className}>
      <div className="relative">
        {/* Horizontal line that spans full width */}
        <div className="absolute top-4 left-0 w-full h-[1px] bg-gray-200" />
        
        <ol className="relative flex justify-between w-full">
          {steps.map((step, index) => {
            const stepNumber = index + 1
            const isCurrentStep = currentStep === stepNumber
            const isCompleted = stepNumber < currentStep

            return (
              <li key={step} className="flex flex-col items-center">
                <div 
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center
                    ${isCurrentStep 
                      ? 'border-2 border-blue-600 bg-white text-blue-600' 
                      : isCompleted 
                        ? 'bg-blue-600 text-white border-2 border-blue-600' 
                        : 'border-2 border-gray-300 bg-white text-gray-500'
                    }
                  `}
                >
                  {isCompleted ? (
                    <CheckIcon className="h-5 w-5 text-white" aria-hidden="true" />
                  ) : (
                    <span className="text-sm font-medium">{stepNumber}</span>
                  )}
                </div>
                <span className="mt-2 text-sm font-medium text-gray-500">
                  {step}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
} 