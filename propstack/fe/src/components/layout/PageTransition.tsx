"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

interface PageTransitionProps {
  children: React.ReactNode
  showBackButton?: boolean
}

export function PageTransition({ children, showBackButton = false }: PageTransitionProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isBack, setIsBack] = useState(false)

  const handleBack = () => {
    setIsBack(true)
    router.back()
  }

  const shouldShowBackButton = showBackButton && pathname !== '/'

  return (
    <div className="relative w-full h-full">
      {shouldShowBackButton && (
        <div className="container mx-auto px-4 mb-2">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-gray-900 text-lg"
          >
            <ChevronLeftIcon className="w-6 h-6" />
            <span>Back</span>
          </button>
        </div>
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ x: isBack ? '-100%' : '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: isBack ? '100%' : '-100%', opacity: 0 }}
          transition={{ type: 'tween', duration: 0.3 }}
          className="w-full h-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
} 