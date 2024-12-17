import { BellIcon, UserCircleIcon } from '@heroicons/react/24/outline'

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Marketing Dashboard</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <BellIcon className="w-6 h-6 text-gray-600" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </div>
          <div className="flex items-center gap-2">
            <UserCircleIcon className="w-6 h-6 text-gray-600" />
            <span className="text-sm text-gray-700">John Doe</span>
          </div>
        </div>
      </div>
    </header>
  )
} 