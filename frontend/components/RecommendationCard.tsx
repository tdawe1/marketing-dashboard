import React from 'react';
import { ArrowRight, Clock, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Recommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  expectedImpact: string;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
}

export default function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{recommendation.title}</CardTitle>
        <div className="flex gap-2">
          <Badge className={getPriorityColor(recommendation.priority)}>
            <Zap className="h-3 w-3 mr-1" />
            {recommendation.priority} priority
          </Badge>
          <Badge className={getEffortColor(recommendation.effort)}>
            <Clock className="h-3 w-3 mr-1" />
            {recommendation.effort} effort
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-gray-700 mb-4">{recommendation.description}</p>
        
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg">
          <ArrowRight className="h-4 w-4" />
          <span className="font-medium">Expected Impact:</span>
          <span>{recommendation.expectedImpact}</span>
        </div>
      </CardContent>
    </Card>
  );
}
