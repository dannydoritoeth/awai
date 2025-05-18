'use client';

import { ResponsiveHeatMap } from '@nivo/heatmap';

export interface CapabilityData {
  taxonomy?: string;
  division?: string;
  region?: string;
  company?: string;
  capability: string;
  role_count: number;
  total_roles: number;
}

interface CapabilityHeatmapProps {
  data: CapabilityData[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  groupBy: 'taxonomy' | 'division' | 'region' | 'company';
}

export default function CapabilityHeatmap({ data, isExpanded = false, groupBy }: CapabilityHeatmapProps) {
  // Process data into format needed for heatmap
  const processData = () => {
    // Get the unique groups based on the groupBy field
    const groups = Array.from(new Set(data.map(d => d[groupBy] || 'Unknown')));
    const capabilities = Array.from(new Set(data.map(d => d.capability)));
    
    return groups.map(group => ({
      id: group,
      data: capabilities.map(capability => {
        const match = data.find(d => d[groupBy] === group && d.capability === capability);
        const percentage = match ? (match.role_count / match.total_roles) * 100 : 0;
        return {
          x: capability,
          y: percentage
        };
      })
    }));
  };

  const heatmapData = processData();
  const height = isExpanded ? '100%' : 200;

  // Get appropriate title based on grouping
  const getLegendTitle = () => {
    switch (groupBy) {
      case 'taxonomy':
        return 'Taxonomy Coverage %';
      case 'division':
        return 'Division Coverage %';
      case 'region':
        return 'Regional Coverage %';
      case 'company':
        return 'Company Coverage %';
      default:
        return 'Coverage %';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div style={{ height }} className="w-full min-h-[700px]">
        <ResponsiveHeatMap
          data={heatmapData}
          margin={{ top: 160, right: 180, bottom: 160, left: 180 }}
          valueFormat=">-.2s"
          axisTop={{
            tickSize: 5,
            tickPadding: 20,
            tickRotation: -45,
            legend: '',
            legendOffset: 80
          }}
          axisBottom={{
            tickSize: 5,
            tickPadding: 20,
            tickRotation: -45,
            legend: '',
            legendOffset: 80
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 20,
            tickRotation: 0,
            legend: '',
            legendPosition: 'middle',
            legendOffset: -100
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
              translateY: 140,
              length: 400,
              thickness: 12,
              direction: 'row',
              tickPosition: 'after',
              tickSize: 3,
              tickSpacing: 4,
              tickOverlap: false,
              title: getLegendTitle(),
              titleAlign: 'start',
              titleOffset: 4
            }
          ]}
          theme={{
            text: {
              fontSize: 12,
              fontFamily: 'system-ui, -apple-system, sans-serif'
            },
            axis: {
              ticks: {
                text: {
                  fontSize: 12
                }
              }
            },
            legends: {
              text: {
                fontSize: 12
              },
              title: {
                text: {
                  fontSize: 13
                }
              }
            }
          }}
          labelTextColor={{
            from: 'color',
            modifiers: [['darker', 3]]
          }}
          hoverTarget="cell"
          enableLabels={true}
          label={datum => datum.value !== null ? `${Math.round(datum.value)}%` : '0%'}
          animate={true}
          motionConfig="gentle"
        />
      </div>
    </div>
  );
} 