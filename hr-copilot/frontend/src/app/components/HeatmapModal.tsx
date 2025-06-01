'use client';

import { useEffect } from 'react';
import { CapabilityData } from './CapabilityHeatmap';
import CapabilityHeatmap from './CapabilityHeatmap';

interface HeatmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: CapabilityData[];
  groupBy: 'taxonomy' | 'division' | 'region' | 'company';
}

export default function HeatmapModal({ isOpen, onClose, data, groupBy }: HeatmapModalProps) {
  // Handle escape key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Prevent scroll on body when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">Capability Coverage Heatmap</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Heatmap Container */}
        <div className="flex-1 p-4 overflow-auto">
          {data.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-700"></div>
              <p className="mt-4 text-gray-600">Loading heatmap data...</p>
            </div>
          ) : (
            <CapabilityHeatmap
              data={data}
              isExpanded={true}
              groupBy={groupBy}
            />
          )}
        </div>
      </div>
    </div>
  );
} 