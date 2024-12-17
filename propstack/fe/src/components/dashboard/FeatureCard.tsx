import { ElementType } from 'react'

interface FeatureCardProps {
  title: string
  subtitle: string
  icon: ElementType
  bgColor: string
  iconColor: string
}

export function FeatureCard({
  title,
  subtitle,
  icon: Icon,
  bgColor,
  iconColor,
}: FeatureCardProps) {
  return (
    <div className={`${bgColor} rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-center gap-4">
        <div className={`${iconColor} p-2`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600">{subtitle}</p>
        </div>
      </div>
    </div>
  )
} 