import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ChartData } from '~backend/dashboard/analyze';

interface ChartCardProps {
  chart: ChartData;
}

export default function ChartCard({ chart }: ChartCardProps) {
  const renderChart = () => {
    const { type, data, xAxisLabel, yAxisLabel, colors } = chart;

    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="label" 
                label={{ value: xAxisLabel, position: 'insideBottom', offset: -5 }}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                formatter={(value: number) => [value.toLocaleString(), yAxisLabel]}
                labelFormatter={(label) => `${xAxisLabel}: ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={colors?.[0] || '#3b82f6'} 
                strokeWidth={2}
                dot={{ fill: colors?.[0] || '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="label" 
                label={{ value: xAxisLabel, position: 'insideBottom', offset: -5 }}
                tick={{ fontSize: 12 }}
                angle={data.length > 5 ? -45 : 0}
                textAnchor={data.length > 5 ? 'end' : 'middle'}
                height={data.length > 5 ? 80 : 60}
              />
              <YAxis 
                label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                formatter={(value: number) => [value.toLocaleString(), yAxisLabel]}
                labelFormatter={(label) => `${xAxisLabel}: ${label}`}
              />
              <Bar 
                dataKey="value" 
                fill={colors?.[0] || '#10b981'}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ label, percent }) => `${label}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={colors?.[index % colors.length] || `hsl(${index * 45}, 70%, 60%)`} 
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [value.toLocaleString(), 'Value']}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="label" 
                label={{ value: xAxisLabel, position: 'insideBottom', offset: -5 }}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                formatter={(value: number) => [value.toLocaleString(), yAxisLabel]}
                labelFormatter={(label) => `${xAxisLabel}: ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={colors?.[0] || '#3b82f6'} 
                strokeWidth={2}
                fill={colors?.[0] || '#3b82f6'}
                fillOpacity={0.3}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="flex items-center justify-center h-64 text-gray-500">
            Unsupported chart type: {type}
          </div>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{chart.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {renderChart()}
      </CardContent>
    </Card>
  );
}
