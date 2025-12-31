import { Upload, Settings, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BrainModule } from "@/lib/ai/brainModules";
import { BRAIN_MODULE_LABELS, BRAIN_MODULE_DESCRIPTIONS } from "@/lib/ai/brainModules";

interface EmptyStateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: BrainModule;
  onUpload: () => void;
  onConfigure: () => void;
}

export function EmptyStateModal({
  open,
  onOpenChange,
  module,
  onUpload,
  onConfigure,
}: EmptyStateModalProps) {
  const label = BRAIN_MODULE_LABELS[module];
  const description = BRAIN_MODULE_DESCRIPTIONS[module];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl">Set Up {label}</DialogTitle>
          <DialogDescription className="text-base">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <p className="text-center text-muted-foreground mb-6">
            Choose how you'd like to configure this brain module:
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Upload Option */}
            <Card
              className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
              onClick={onUpload}
            >
              <CardHeader className="pb-2">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Upload a Document</CardTitle>
                <CardDescription>
                  Upload an existing PDF, DOCX, MD, or TXT file
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Supports PDF, DOCX, Markdown, Text
                  </li>
                  <li className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    AI analyzes and transforms content
                  </li>
                </ul>
                <Button className="w-full mt-4">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </CardContent>
            </Card>

            {/* Configure Option */}
            <Card
              className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
              onClick={onConfigure}
            >
              <CardHeader className="pb-2">
                <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-2">
                  <Settings className="h-6 w-6 text-secondary-foreground" />
                </div>
                <CardTitle className="text-lg">Configure Manually</CardTitle>
                <CardDescription>
                  Use our guided form to set up this module
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Step-by-step configuration
                  </li>
                  <li className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Follows our recommended structure
                  </li>
                </ul>
                <Button variant="outline" className="w-full mt-4">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            You can always upload additional documents or reconfigure later.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
