export function StatusBadge({ status }: { status: string }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'title_search':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'review':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'agreement':
        return 'bg-green-50 text-green-700 border-green-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'new':
        return 'New'
      case 'title_search':
        return 'Title Search'
      case 'review':
        return 'Review'
      case 'agreement':
        return 'Agreement'
      default:
        return status
    }
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
      {getStatusText(status)}
    </span>
  )
} 