import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, TrendingUp, Zap, Link, BarChart3, Layers, Clock, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import FileUpload from '../components/FileUpload';
import FeatureCard from '../components/FeatureCard';
import IntegrationsGrid from '../components/IntegrationsGrid';
import DemoModeToggle from '../components/DemoModeToggle';
import { useDemoMode } from '../hooks/useDemoMode';

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadSuccess = (fileId: string) => {
    toast({
      title: "Upload successful",
      description: isDemoMode 
        ? "Demo file loaded successfully and is ready for analysis."
        : "Your file has been uploaded and is ready for analysis.",
    });
    navigate(`/analysis/${fileId}`);
  };

  const handleUploadError = (error: string) => {
    toast({
      title: "Upload failed",
      description: error,
      variant: "destructive",
    });
  };

  const handleDataFetched = (fileId: string) => {
    navigate(`/analysis/${fileId}`);
  };

  const features = [
    {
      icon: Layers,
      title: "Unified Dashboard",
      description: "Compare performance across all platforms and data sources in one view"
    },
    {
      icon: Clock,
      title: "Automated Scheduling",
      description: "Set up daily, weekly, or monthly data fetching with email notifications"
    },
    {
      icon: Link,
      title: "Direct Integrations",
      description: "Connect GA4, Google Ads, Facebook Ads, and more platforms directly"
    },
    {
      icon: Upload,
      title: "File Upload",
      description: "Upload CSV, Excel files, or any marketing data manually"
    },
    {
      icon: TrendingUp,
      title: "AI Insights",
      description: "Get intelligent analysis and key insights from your data"
    },
    {
      icon: Zap,
      title: "Smart Recommendations",
      description: "Receive actionable recommendations to improve performance"
    },
    {
      icon: FileText,
      title: "Multi-format Export",
      description: "Export as email summaries, LinkedIn posts, or detailed reports"
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <DemoModeToggle isDemoMode={isDemoMode} onToggle={toggleDemoMode} />
        </div>
        
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Auto-Reporting Dashboard
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Connect your marketing platforms or upload data files to get AI-powered insights, 
          recommendations, and shareable reports in seconds.
        </p>
        
        {isDemoMode && (
          <Alert className="max-w-2xl mx-auto mt-6 border-purple-200 bg-purple-50">
            <Eye className="h-4 w-4 text-purple-600" />
            <AlertDescription className="text-purple-800">
              <strong>Demo Mode Active:</strong> All features are available with sample data. 
              Perfect for exploring the dashboard's capabilities without real integrations.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex justify-center gap-4 mb-12">
        <Button 
          onClick={() => navigate('/unified')}
          size="lg"
          className="flex items-center gap-2"
        >
          <Layers className="h-5 w-5" />
          Unified Dashboard
        </Button>
        <Button 
          onClick={() => navigate('/scheduling')}
          size="lg"
          variant="outline"
          className="flex items-center gap-2"
        >
          <Clock className="h-5 w-5" />
          Scheduled Jobs
        </Button>
        <Button 
          variant="outline"
          size="lg"
          onClick={() => document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' })}
          className="flex items-center gap-2"
        >
          <Upload className="h-5 w-5" />
          {isDemoMode ? 'Try Upload' : 'Quick Upload'}
        </Button>
      </div>

      <div id="upload-section" className="max-w-4xl mx-auto mb-12">
        <Tabs defaultValue="integrations" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="integrations" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Platform Integrations
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              File Upload
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="integrations" className="mt-6">
            <IntegrationsGrid onDataFetched={handleDataFetched} />
          </TabsContent>
          
          <TabsContent value="upload" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  {isDemoMode ? 'Try File Upload with Demo Data' : 'Upload Your Report'}
                </CardTitle>
                <CardDescription>
                  {isDemoMode 
                    ? 'Experience the upload process with sample marketing data'
                    : 'Support for GA4 exports, advertising CSVs, and other marketing data files'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={handleUploadError}
                  isUploading={isUploading}
                  setIsUploading={setIsUploading}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {features.map((feature, index) => (
          <FeatureCard
            key={index}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
          />
        ))}
      </div>

      <div className="text-center">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Perfect for Marketing Teams & Agencies</CardTitle>
            <CardDescription>
              Save hours of manual analysis and get professional insights instantly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="font-semibold text-blue-600">Marketing Teams</div>
                <div className="text-gray-600">Automated weekly performance reviews</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-green-600">Solo Consultants</div>
                <div className="text-gray-600">Streamlined client reporting</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-purple-600">Agencies</div>
                <div className="text-gray-600">Multi-client insights at scale</div>
              </div>
            </div>
            
            {isDemoMode && (
              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-medium text-purple-900 mb-2">🎯 Demo Mode Features</h4>
                <p className="text-sm text-purple-800">
                  All features are fully functional with realistic sample data. Try uploading files, 
                  connecting platforms, creating scheduled jobs, and exploring the unified dashboard. 
                  Perfect for showcasing capabilities to clients or stakeholders.
                </p>
              </div>
            )}
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-medium text-purple-900 mb-2">🕒 New: Automated Scheduling</h4>
              <p className="text-sm text-purple-800">
                Set up automated data fetching from your connected platforms. Get daily, weekly, or monthly 
                reports with AI analysis delivered straight to your inbox. Never miss important insights again.
              </p>
              <Button 
                onClick={() => navigate('/scheduling')}
                className="mt-3"
                size="sm"
              >
                <Clock className="h-4 w-4 mr-2" />
                {isDemoMode ? 'Try Automation Demo' : 'Set Up Automation'}
              </Button>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">🚀 Unified Dashboard</h4>
              <p className="text-sm text-blue-800">
                Compare performance across all your connected platforms and uploaded files in one unified view. 
                Identify trends, spot opportunities, and make data-driven decisions faster than ever.
              </p>
              <Button 
                onClick={() => navigate('/unified')}
                className="mt-3"
                size="sm"
                variant="outline"
              >
                <Layers className="h-4 w-4 mr-2" />
                {isDemoMode ? 'Try Unified Dashboard' : 'Try Unified Dashboard'}
              </Button>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">🔗 Direct Platform Integrations</h4>
              <p className="text-sm text-green-800">
                {isDemoMode 
                  ? 'Experience seamless platform connections with demo accounts. See how Google Analytics, Google Ads, and Facebook Ads data flows into your dashboard automatically.'
                  : 'Connect your Google Analytics, Google Ads, and Facebook Ads accounts directly. No more manual exports - just select your date range and get instant insights.'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
