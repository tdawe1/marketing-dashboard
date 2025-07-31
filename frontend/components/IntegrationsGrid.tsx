import React from 'react';
import { BarChart3, Target, Share2 } from 'lucide-react';
import IntegrationCard from './IntegrationCard';

interface IntegrationsGridProps {
  onDataFetched: (fileId: string) => void;
}

export default function IntegrationsGrid({ onDataFetched }: IntegrationsGridProps) {
  const platforms = [
    {
      id: 'google-analytics',
      name: 'Google Analytics 4',
      icon: <BarChart3 className="h-6 w-6 text-orange-600" />,
      color: 'bg-orange-500',
      description: 'Website traffic and user behavior data'
    },
    {
      id: 'google-ads',
      name: 'Google Ads',
      icon: <Target className="h-6 w-6 text-blue-600" />,
      color: 'bg-blue-500',
      description: 'Search and display advertising performance'
    },
    {
      id: 'facebook-ads',
      name: 'Facebook Ads',
      icon: <Share2 className="h-6 w-6 text-blue-700" />,
      color: 'bg-blue-700',
      description: 'Social media advertising campaigns'
    }
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Connect Your Platforms</h2>
      <p className="text-gray-600 mb-6">
        Connect your marketing platforms to automatically fetch data for analysis. 
        No more manual exports or file uploads required.
      </p>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {platforms.map(platform => (
          <IntegrationCard
            key={platform.id}
            platform={platform}
            onDataFetched={onDataFetched}
          />
        ))}
      </div>
    </div>
  );
}
