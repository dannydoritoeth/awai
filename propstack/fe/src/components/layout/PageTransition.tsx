"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'

interface PageTransitionProps {
  children: React.ReactNode
  showBackButton?: boolean
}

export function PageTransition({ children, showBackButton = false }: PageTransitionProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isBack, setIsBack] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsBack(false), 300) // Reset after animation
    return () => clearTimeout(timer)
  }, [pathname])

  const handleBack = () => {
    setIsBack(true)
    router.back()
  }

  return (
    <div className="relative w-full h-full">
      {showBackButton && (
        <button
          onClick={handleBack}
          className="absolute top-4 left-4 z-50 p-2 rounded-full bg-white shadow-md hover:bg-gray-50"
        >
          <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
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