import { create } from 'zustand';

interface FilterState {
  filters: {
    institution?: string;
    company?: string;
    division?: string;
    capability?: string;
    skill?: string;
    careerType?: string;
    role?: string;
    generalRole?: string;
    specificRole?: string;
  };
  setFilters: (newFilters: Partial<FilterState['filters']>) => void;
  clearFilters: () => void;
}

export const useFilterStore = create<FilterState>()((set) => ({
  filters: {},
  setFilters: (newFilters) => set((state) => ({
    filters: {
      ...state.filters,
      ...newFilters
    }
  })),
  clearFilters: () => set({ filters: {} })
})); 