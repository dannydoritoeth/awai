import Link from 'next/link'
import { ElementType } from 'react'

interface MarketingToolProps {
  title: string
  description: string
  icon: ElementType
  href: string
  color: string
  iconColor: string
}

export function MarketingTool({
  title,
  description,
  icon: Icon,
  href,
  color,
  iconColor
}: MarketingToolProps) {
  return (
    <Link 
      href={href}
      className={`
        ${color} 
        p-6 
        rounded-xl 
        shadow-sm 
        hover:shadow-md 
        transition-all 
        duration-200 
        transform 
        hover:scale-[1.02]
      `}
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </Link>
  )
} 