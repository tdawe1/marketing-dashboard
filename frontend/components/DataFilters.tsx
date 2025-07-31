import React, { useState, useEffect } from 'react';
import { Calendar, Filter, X, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { FilterOptions, DataSummary } from '~backend/dashboard/analyze';

interface DataFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  dataSummary?: DataSummary;
  isLoading?: boolean;
}

export default function DataFilters({ filters, onFiltersChange, dataSummary, isLoading }: DataFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleDateRangeChange = (field: 'startDate' | 'endDate', value: string) => {
    const newFilters = {
      ...localFilters,
      dateRange: {
        ...localFilters.dateRange,
        [field]: value || undefined
      }
    };
    setLocalFilters(newFilters);
  };

  const handleMetricToggle = (metric: string) => {
    const currentMetrics = localFilters.selectedMetrics || [];
    const newMetrics = currentMetrics.includes(metric)
      ? currentMetrics.filter(m => m !== metric)
      : [...currentMetrics, metric];
    
    setLocalFilters({
      ...localFilters,
      selectedMetrics: newMetrics.length > 0 ? newMetrics : undefined
    });
  };

  const handleCategoryToggle = (category: string) => {
    const currentCategories = localFilters.selectedCategories || [];
    const newCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category];
    
    setLocalFilters({
      ...localFilters,
      selectedCategories: newCategories.length > 0 ? newCategories : undefined
    });
  };

  const handleValueRangeChange = (field: 'minValue' | 'maxValue', value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    setLocalFilters({
      ...localFilters,
      [field]: numValue
    });
  };

  const applyFilters = () => {
    onFiltersChange(localFilters);
  };

  const resetFilters = () => {
    const emptyFilters: FilterOptions = {};
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
  };

  const hasActiveFilters = () => {
    return !!(
      localFilters.dateRange?.startDate ||
      localFilters.dateRange?.endDate ||
      localFilters.selectedMetrics?.length ||
      localFilters.selectedCategories?.length ||
      localFilters.minValue !== undefined ||
      localFilters.maxValue !== undefined
    );
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (localFilters.dateRange?.startDate || localFilters.dateRange?.endDate) count++;
    if (localFilters.selectedMetrics?.length) count++;
    if (localFilters.selectedCategories?.length) count++;
    if (localFilters.minValue !== undefined || localFilters.maxValue !== undefined) count++;
    return count;
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Data Filters
                {hasActiveFilters() && (
                  <Badge variant="secondary" className="ml-2">
                    {getActiveFilterCount()} active
                  </Badge>
                )}
              </div>
              <div className="text-sm font-normal text-gray-500">
                {isOpen ? 'Hide filters' : 'Show filters'}
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Date Range Filter */}
            {dataSummary?.dateRange && (
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date Range
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="startDate" className="text-xs text-gray-600">From</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={localFilters.dateRange?.startDate || ''}
                      onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                      min={dataSummary.dateRange.earliest}
                      max={dataSummary.dateRange.latest}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate" className="text-xs text-gray-600">To</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={localFilters.dateRange?.endDate || ''}
                      onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                      min={dataSummary.dateRange.earliest}
                      max={dataSummary.dateRange.latest}
                      className="text-sm"
                    />
                  </div>
                </div>
                {dataSummary.dateRange.earliest && dataSummary.dateRange.latest && (
                  <p className="text-xs text-gray-500">
                    Available range: {dataSummary.dateRange.earliest} to {dataSummary.dateRange.latest}
                  </p>
                )}
              </div>
            )}

            {/* Metrics Filter */}
            {dataSummary?.availableMetrics && dataSummary.availableMetrics.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Focus Metrics</Label>
                <div className="flex flex-wrap gap-2">
                  {dataSummary.availableMetrics.map(metric => (
                    <Badge
                      key={metric}
                      variant={localFilters.selectedMetrics?.includes(metric) ? "default" : "outline"}
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleMetricToggle(metric)}
                    >
                      {metric}
                      {localFilters.selectedMetrics?.includes(metric) && (
                        <X className="h-3 w-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  Select specific metrics to focus the analysis on
                </p>
              </div>
            )}

            {/* Categories Filter */}
            {dataSummary?.availableCategories && dataSummary.availableCategories.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Categories</Label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {dataSummary.availableCategories.slice(0, 20).map(category => (
                    <Badge
                      key={category}
                      variant={localFilters.selectedCategories?.includes(category) ? "default" : "outline"}
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleCategoryToggle(category)}
                    >
                      {category.length > 15 ? category.substring(0, 15) + '...' : category}
                      {localFilters.selectedCategories?.includes(category) && (
                        <X className="h-3 w-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
                {dataSummary.availableCategories.length > 20 && (
                  <p className="text-xs text-gray-500">
                    Showing first 20 categories. Apply filters to see results.
                  </p>
                )}
              </div>
            )}

            {/* Value Range Filter */}
            {dataSummary?.availableMetrics && dataSummary.availableMetrics.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Value Range</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="minValue" className="text-xs text-gray-600">Minimum</Label>
                    <Input
                      id="minValue"
                      type="number"
                      placeholder="Min value"
                      value={localFilters.minValue ?? ''}
                      onChange={(e) => handleValueRangeChange('minValue', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxValue" className="text-xs text-gray-600">Maximum</Label>
                    <Input
                      id="maxValue"
                      type="number"
                      placeholder="Max value"
                      value={localFilters.maxValue ?? ''}
                      onChange={(e) => handleValueRangeChange('maxValue', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Filter rows based on the primary metric values
                </p>
              </div>
            )}

            {/* Data Summary */}
            {dataSummary && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Data Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>Total rows: {dataSummary.totalRows.toLocaleString()}</div>
                  <div>Filtered rows: {dataSummary.filteredRows.toLocaleString()}</div>
                  <div>Metrics: {dataSummary.availableMetrics.length}</div>
                  <div>Categories: {dataSummary.availableCategories.length}</div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t">
              <Button 
                onClick={applyFilters} 
                disabled={isLoading}
                className="flex-1"
              >
                Apply Filters
              </Button>
              <Button 
                variant="outline" 
                onClick={resetFilters}
                disabled={!hasActiveFilters() || isLoading}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
