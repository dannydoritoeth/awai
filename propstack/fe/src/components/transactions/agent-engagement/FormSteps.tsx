import { CheckIcon } from '@heroicons/react/24/solid'

interface FormStepsProps {
  steps: string[]
  currentStep: number
}

export function FormSteps({ steps, currentStep }: FormStepsProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const isCompleted = stepNumber < currentStep
          const isCurrent = stepNumber === currentStep

          return (
            <div key={step} className="flex flex-col items-center">
              <div className="flex items-center">
                {/* Circle with number or check */}
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center
                    ${isCompleted 
                      ? 'bg-indigo-600' 
                      : isCurrent 
                        ? 'bg-indigo-600'
                        : 'bg-gray-200'
                    }
                  `}
                >
                  {isCompleted ? (
                    <CheckIcon className="w-5 h-5 text-white" />
                  ) : (
                    <span className={isCurrent ? 'text-white' : 'text-gray-500'}>
                      {stepNumber}
                    </span>
                  )}
                </div>

                {/* Connecting line */}
                {index < steps.length - 1 && (
                  <div 
                    className={`
                      w-32 h-0.5 mx-2
                      ${isCompleted ? 'bg-indigo-600' : 'bg-gray-200'}
                    `}
                  />
                )}
              </div>

              {/* Step label */}
              <div className="mt-2 text-center">
                <div className={`text-sm ${isCurrent ? 'text-indigo-600 font-medium' : 'text-gray-500'}`}>
                  {step}
                </div>
                {isCurrent && (
                  <div className="text-xs text-indigo-600">
                    Current step
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
} 