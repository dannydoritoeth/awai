interface StatusBadgeProps {
  status: string
  type: 'review' | 'title' | 'social' | 'images'
}

export function StatusBadge({ status, type }: StatusBadgeProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'uploaded':
        return 'bg-yellow-100 text-yellow-800'
      case 'described':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getLabel = () => {
    switch (type) {
      case 'review':
        return 'Review'
      case 'title':
        return 'Title Check'
      case 'social':
        return 'Social Media'
      case 'images':
        return 'Images'
      default:
        return type
    }
  }

  return (
    <div className="flex items-center space-x-2">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}>
        {getLabel()}: {status}
      </span>
    </div>
  )
} 