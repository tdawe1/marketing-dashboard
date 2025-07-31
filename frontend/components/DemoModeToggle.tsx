import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DemoModeToggleProps {
  isDemoMode: boolean;
  onToggle: () => void;
}

export default function DemoModeToggle({ isDemoMode, onToggle }: DemoModeToggleProps) {
  return (
    <div className="flex items-center gap-2">
      {isDemoMode && (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
          Demo Mode
        </Badge>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="flex items-center gap-2"
      >
        {isDemoMode ? (
          <>
            <EyeOff className="h-4 w-4" />
            Exit Demo
          </>
        ) : (
          <>
            <Eye className="h-4 w-4" />
            Demo Mode
          </>
        )}
      </Button>
    </div>
  );
}
