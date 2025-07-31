import React from 'react';
import { TrendingUp, AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Insight {
  category: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  metrics?: Record<string, number>;
}

interface InsightCardProps {
  insight: Insight;
}

export default function InsightCard({ insight }: InsightCardProps) {
  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      case 'medium':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{insight.title}</CardTitle>
          <Badge className={getImpactColor(insight.impact)}>
            {getImpactIcon(insight.impact)}
            <span className="ml-1 capitalize">{insight.impact}</span>
          </Badge>
        </div>
        <Badge variant="outline" className="w-fit">
          {insight.category}
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="text-gray-700 mb-4">{insight.description}</p>
        
        {insight.metrics && Object.keys(insight.metrics).length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-gray-900">Related Metrics</h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(insight.metrics).map(([key, value]) => (
                <div key={key} className="text-sm">
                  <span className="text-gray-600">{key}:</span>
                  <span className="font-medium ml-1">{value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
