import React from 'react';
import ChartCard from './ChartCard';
import type { ChartData } from '~backend/dashboard/analyze';

interface ChartsGridProps {
  charts: ChartData[];
}

export default function ChartsGrid({ charts }: ChartsGridProps) {
  if (!charts || charts.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Data Visualizations</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {charts.map((chart, index) => (
          <ChartCard key={index} chart={chart} />
        ))}
      </div>
    </div>
  );
}
