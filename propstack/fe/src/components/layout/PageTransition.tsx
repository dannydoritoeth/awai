"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { navigationStore } from '@/lib/navigation'

interface PageTransitionProps {
  children: React.ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()

  return (
    <div className="relative w-full h-full">
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ x: navigationStore.isBackNavigation ? '-100%' : '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: navigationStore.isBackNavigation ? '100%' : '-100%', opacity: 0 }}
          transition={{ type: 'tween', duration: 0.3 }}
          onAnimationComplete={() => {
            navigationStore.isBackNavigation = false
          }}
          className="w-full h-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
} 