import { useState, useEffect } from 'react';
import { getCategories } from '@/lib/services/categories';
import { CustomSelect } from '@/components/ui/custom-select';
import type { Capability } from '@/lib/services/capabilities';

interface FilterOption {
  id: string;
  name: string;
}

export interface CapabilityFilters {
  group: string;
  type: string;
  level: string;
}

interface CapabilityFiltersProps {
  onFilterChange: (filters: CapabilityFilters) => void;
}

export default function CapabilityFilters({ onFilterChange }: CapabilityFiltersProps) {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<FilterOption[]>([]);
  const [types, setTypes] = useState<FilterOption[]>([]);
  const [levels, setLevels] = useState<FilterOption[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        setLoading(true);
        
        // Load capabilities and extract unique values
        const capabilities = await getCategories('capability');
        
        // Extract unique groups, types, and levels
        const uniqueGroups = new Set<string>();
        const uniqueTypes = new Set<string>();
        const uniqueLevels = new Set<string>();

        capabilities.forEach((cap: Capability) => {
          if (cap.group_name) uniqueGroups.add(cap.group_name);
          if (cap.type) uniqueTypes.add(cap.type);
          if (cap.level) uniqueLevels.add(cap.level);
        });

        // Convert sets to FilterOption arrays
        const createFilterOptions = (values: Set<string>): FilterOption[] => {
          return Array.from(values).map(value => ({
            id: value,
            name: value
          }));
        };

        setGroups(createFilterOptions(uniqueGroups));
        setTypes(createFilterOptions(uniqueTypes));
        setLevels(createFilterOptions(uniqueLevels));
      } catch (error) {
        console.error('Error loading filter options:', error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadFilterOptions();
  }, []);

  const handleGroupChange = (value: string) => {
    setSelectedGroup(value);
    onFilterChange({
      group: value,
      type: selectedType,
      level: selectedLevel
    });
  };

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    onFilterChange({
      group: selectedGroup,
      type: value,
      level: selectedLevel
    });
  };

  const handleLevelChange = (value: string) => {
    setSelectedLevel(value);
    onFilterChange({
      group: selectedGroup,
      type: selectedType,
      level: value
    });
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-10 bg-gray-100 rounded"></div>
      <div className="h-10 bg-gray-100 rounded"></div>
      <div className="h-10 bg-gray-100 rounded"></div>
    </div>;
  }

  return (
    <div className="space-y-4 bg-white p-4 rounded-lg shadow-sm">
      <CustomSelect
        label="Group"
        value={selectedGroup}
        onChange={handleGroupChange}
        options={groups.map(g => ({
          value: g.id,
          label: g.name
        }))}
        placeholder="Select group"
      />

      <CustomSelect
        label="Type"
        value={selectedType}
        onChange={handleTypeChange}
        options={types.map(t => ({
          value: t.id,
          label: t.name
        }))}
        placeholder="Select type"
      />

      <CustomSelect
        label="Level"
        value={selectedLevel}
        onChange={handleLevelChange}
        options={levels.map(l => ({
          value: l.id,
          label: l.name
        }))}
        placeholder="Select level"
      />
    </div>
  );
} 