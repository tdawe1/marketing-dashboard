import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import UnifiedDashboardPage from './pages/UnifiedDashboardPage';
import SchedulingPage from './pages/SchedulingPage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/analysis/:fileId" element={<Analysis />} />
            <Route path="/unified" element={<UnifiedDashboardPage />} />
            <Route path="/scheduling" element={<SchedulingPage />} />
          </Routes>
        </div>
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}
