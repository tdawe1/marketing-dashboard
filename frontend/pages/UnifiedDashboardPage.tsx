import React from 'react';
import { useNavigate } from 'react-router-dom';
import UnifiedDashboard from '../components/UnifiedDashboard';

export default function UnifiedDashboardPage() {
  const navigate = useNavigate();

  const handleNavigateToAnalysis = (fileId: string) => {
    navigate(`/analysis/${fileId}`);
  };

  return (
    <UnifiedDashboard onNavigateToAnalysis={handleNavigateToAnalysis} />
  );
}
