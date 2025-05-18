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

export default function CapabilityHeatmap({ data, isExpanded = false }: CapabilityHeatmapProps) {
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
  const height = isExpanded ? '100%' : 200;

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
              title: 'Coverage %',
              titleAlign: 'start',
              titleOffset: 4
            }
          ]}
          theme={{
            fontSize: 12,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textColor: '#333333',
            axis: {
              domain: {
                line: {
                  stroke: '#dddddd',
                  strokeWidth: 1
                }
              },
              ticks: {
                line: {
                  stroke: '#777777',
                  strokeWidth: 1
                },
                text: {
                  fill: '#333333'
                }
              }
            },
            grid: {
              line: {
                stroke: '#dddddd',
                strokeWidth: 1
              }
            },
            legends: {
              text: {
                fill: '#333333'
              },
              title: {
                fill: '#333333'
              },
              ticks: {
                line: {
                  stroke: '#777777',
                  strokeWidth: 1
                },
                text: {
                  fill: '#333333'
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