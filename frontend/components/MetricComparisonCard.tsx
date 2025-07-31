import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { MetricComparison } from '~backend/dashboard/unified-metrics';

interface MetricComparisonCardProps {
  comparison: MetricComparison;
}

export default function MetricComparisonCard({ comparison }: MetricComparisonCardProps) {
  const formatValue = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'google-analytics':
        return 'bg-orange-100 text-orange-800';
      case 'google-ads':
        return 'bg-blue-100 text-blue-800';
      case 'facebook-ads':
        return 'bg-blue-100 text-blue-900';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const maxValue = Math.max(...comparison.sources.map(s => s.value));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg capitalize">
          {comparison.metricName.replace(/_/g, ' ')}
        </CardTitle>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>Total: {formatValue(comparison.totalValue)}</span>
          <span>Average: {formatValue(comparison.averageValue)}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Best Performer Highlight */}
          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-green-900">
                  🏆 {comparison.bestPerforming.sourceName}
                </div>
                <div className="text-sm text-green-700">
                  Top performer with {formatValue(comparison.bestPerforming.value)}
                </div>
              </div>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
          </div>

          {/* Source Breakdown */}
          <div className="space-y-3">
            {comparison.sources
              .sort((a, b) => b.value - a.value)
              .map((source, index) => {
                const percentage = maxValue > 0 ? (source.value / maxValue) * 100 : 0;
                const isTopPerformer = source.sourceId === comparison.bestPerforming.sourceId;
                
                return (
                  <div key={source.sourceId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {source.sourceName}
                        </span>
                        <Badge className={getPlatformColor(source.platform)}>
                          {source.platform}
                        </Badge>
                        {isTopPerformer && (
                          <Badge className="bg-green-100 text-green-800">
                            Best
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm font-medium">
                        {formatValue(source.value)}
                      </div>
                    </div>
                    <Progress 
                      value={percentage} 
                      className={`h-2 ${isTopPerformer ? 'bg-green-100' : ''}`}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{percentage.toFixed(1)}% of max</span>
                      {source.change !== undefined && (
                        <span className={`flex items-center gap-1 ${
                          source.change > 0 ? 'text-green-600' : 
                          source.change < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {source.change > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : source.change < 0 ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : (
                            <Minus className="h-3 w-3" />
                          )}
                          {source.changePercent !== undefined && 
                            `${Math.abs(source.changePercent).toFixed(1)}%`
                          }
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Performance Gap Analysis */}
          {comparison.sources.length > 1 && (
            <div className="pt-3 border-t">
              <div className="text-xs text-gray-600">
                Performance gap: {(
                  ((comparison.bestPerforming.value - Math.min(...comparison.sources.map(s => s.value))) / 
                   Math.min(...comparison.sources.map(s => s.value))) * 100
                ).toFixed(1)}% between best and worst performer
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
