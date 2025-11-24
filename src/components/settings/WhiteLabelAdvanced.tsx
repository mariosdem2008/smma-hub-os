import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WhiteLabelAdvancedProps {
  sectionLabels: Record<string, string>;
  onSave: (labels: Record<string, string>) => void;
}

const defaultLabels = {
  overview: 'Overview',
  content_calendar: 'Content Calendar',
  ideas: 'Ideas',
  assets: 'Assets',
  branding: 'Branding',
  social: 'Social Profiles',
  deliverables: 'Deliverables',
  uploads: 'My Uploads',
};

export function WhiteLabelAdvanced({ sectionLabels, onSave }: WhiteLabelAdvancedProps) {
  const [labels, setLabels] = useState({ ...defaultLabels, ...sectionLabels });
  const { toast } = useToast();

  const handleSave = () => {
    onSave(labels);
    toast({
      title: 'Success',
      description: 'Section labels saved successfully',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <CardTitle>Advanced Customization</CardTitle>
        </div>
        <CardDescription>
          Customize portal section names to match your agency's terminology
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(labels).map(([key, value]) => (
            <div key={key}>
              <Label htmlFor={key} className="capitalize">
                {key.replace('_', ' ')}
              </Label>
              <Input
                id={key}
                value={value}
                onChange={(e) => setLabels({ ...labels, [key]: e.target.value })}
                className="mt-2"
              />
            </div>
          ))}
        </div>
        
        <Button onClick={handleSave} className="w-full">
          <Save className="mr-2 h-4 w-4" />
          Save Section Labels
        </Button>
      </CardContent>
    </Card>
  );
}
