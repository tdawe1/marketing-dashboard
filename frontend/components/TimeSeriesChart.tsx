import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TimeSeriesData, MetricSource } from '~backend/dashboard/unified-metrics';

interface TimeSeriesChartProps {
  title: string;
  data: TimeSeriesData[];
  sources: MetricSource[];
}

export default function TimeSeriesChart({ title, data, sources }: TimeSeriesChartProps) {
  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
    '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
  ];

  const getSourceName = (sourceId: string) => {
    const source = sources.find(s => s.id === sourceId);
    return source?.name || sourceId;
  };

  const formatValue = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Prepare data for the chart
  const chartData = data.map(item => ({
    date: formatDate(item.date),
    fullDate: item.date,
    total: item.total,
    ...Object.fromEntries(
      Object.entries(item.sources).map(([sourceId, value]) => [
        getSourceName(sourceId), 
        value
      ])
    )
  }));

  // Get unique source names for lines
  const sourceNames = Array.from(
    new Set(
      data.flatMap(item => 
        Object.keys(item.sources).map(sourceId => getSourceName(sourceId))
      )
    )
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg capitalize">
          {title.replace(/_/g, ' ')} Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={formatValue}
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                formatValue(value), 
                name
              ]}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  return `Date: ${payload[0].payload.fullDate}`;
                }
                return `Date: ${label}`;
              }}
            />
            <Legend />
            
            {/* Total line */}
            <Line
              type="monotone"
              dataKey="total"
              stroke="#374151"
              strokeWidth={3}
              strokeDasharray="5 5"
              dot={{ fill: '#374151', strokeWidth: 2, r: 4 }}
              name="Total"
            />
            
            {/* Individual source lines */}
            {sourceNames.map((sourceName, index) => (
              <Line
                key={sourceName}
                type="monotone"
                dataKey={sourceName}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ fill: colors[index % colors.length], strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5 }}
                name={sourceName}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        
        {/* Summary Stats */}
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Total Peak</div>
              <div className="font-medium">
                {formatValue(Math.max(...data.map(d => d.total)))}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Total Average</div>
              <div className="font-medium">
                {formatValue(data.reduce((sum, d) => sum + d.total, 0) / data.length)}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Data Points</div>
              <div className="font-medium">{data.length}</div>
            </div>
            <div>
              <div className="text-gray-600">Sources</div>
              <div className="font-medium">{sourceNames.length}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
