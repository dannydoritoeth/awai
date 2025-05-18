'use client';

import { ResponsiveHeatMap } from '@nivo/heatmap';

export interface CapabilityData {
  taxonomy: string;
  capability: string;
  percentage: number;
}

interface CapabilityHeatmapProps {
  data: CapabilityData[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export default function CapabilityHeatmap({ data, isExpanded = false, onToggleExpand }: CapabilityHeatmapProps) {
  // Process data into format needed for heatmap
  const processData = () => {
    const taxonomies = Array.from(new Set(data.map(d => d.taxonomy)));
    const capabilities = Array.from(new Set(data.map(d => d.capability)));
    
    return taxonomies.map(taxonomy => ({
      id: taxonomy,
      data: capabilities.map(capability => {
        const match = data.find(d => d.taxonomy === taxonomy && d.capability === capability);
        return {
          x: capability,
          y: match ? match.percentage : 0
        };
      })
    }));
  };

  const heatmapData = processData();
  const height = isExpanded ? 400 : 200;

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Capability Coverage</h3>
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="text-blue-600 hover:text-blue-800"
            >
              {isExpanded ? 'Minimize' : 'Expand'}
            </button>
          )}
        </div>
        
        <div style={{ height }} className="w-full">
          <ResponsiveHeatMap
            data={heatmapData}
            margin={{ top: 60, right: 90, bottom: 60, left: 90 }}
            valueFormat=">-.2s"
            axisTop={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: -45,
              legend: '',
              legendOffset: 46
            }}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: -45,
              legend: '',
              legendOffset: 46
            }}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: '',
              legendOffset: -72
            }}
            colors={{
              type: 'sequential',
              scheme: 'blues'
            }}
            emptyColor="#f8f9fa"
            legends={[
              {
                anchor: 'bottom',
                translateX: 0,
                translateY: 30,
                length: 400,
                thickness: 8,
                direction: 'row',
                tickPosition: 'after',
                tickSize: 3,
                tickSpacing: 4,
                tickOverlap: false,
                title: 'Coverage %',
                titleAlign: 'start',
                titleOffset: 4
              }
            ]}
          />
        </div>
      </div>
    </div>
  );
} 