import { useState } from "react";
import {
  Building2,
  Shield,
  Target,
  FileText,
  MessageSquare,
  HelpCircle,
  Key,
  DollarSign,
  Star,
  Edit,
  History,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  BRAIN_MODULE_LABELS,
  BRAIN_MODULE_DESCRIPTIONS,
  isReadOnlyModule,
  type BrainModule,
  type BrainDocumentStatus,
} from "@/lib/ai/brainModules";
import type { BrainDocument } from "@/lib/ai/brainDocuments";
import { BrainModuleEditor } from "./BrainModuleEditor";
import { BrainVersionHistory } from "./BrainVersionHistory";

const MODULE_ICONS: Record<BrainModule, React.ElementType> = {
  bootstrap: Building2,
  rep_policy: Shield,
  sop_strategy: Target,
  sop_scripting: FileText,
  tone_voice: MessageSquare,
  faq_objections: HelpCircle,
  ai_permissions: Key,
  offer_stack: DollarSign,
  quality_bar: Star,
};

const STATUS_CONFIG: Record<BrainDocumentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  draft: { label: "Draft", variant: "secondary", icon: Edit },
  pending_approval: { label: "Pending", variant: "outline", icon: Clock },
  approved: { label: "Active", variant: "default", icon: CheckCircle },
  archived: { label: "Archived", variant: "destructive", icon: AlertCircle },
};

interface BrainModuleCardProps {
  module: BrainModule;
  document: BrainDocument | null;
  hasDraft?: boolean;
  onEdit?: () => void;
  onApprove?: () => void;
  onImprove?: () => void;
}

export function BrainModuleCard({
  module,
  document,
  hasDraft,
  onEdit,
  onApprove,
  onImprove,
}: BrainModuleCardProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const Icon = MODULE_ICONS[module];
  const label = BRAIN_MODULE_LABELS[module];
  const description = BRAIN_MODULE_DESCRIPTIONS[module];
  const isReadOnly = isReadOnlyModule(module);

  const status = document?.status;
  const statusConfig = status ? STATUS_CONFIG[status] : null;
  const StatusIcon = statusConfig?.icon;

  const isEmpty = !document;
  const isApproved = status === "approved";
  const canEdit = !isReadOnly && (!status || status !== "approved");
  const canApprove = status === "draft" || status === "pending_approval";

  // Calculate content preview
  const contentPreview = document?.content_json
    ? Object.keys(document.content_json).length + " fields configured"
    : "Not configured";

  return (
    <Card className={`relative transition-all hover:shadow-md ${isEmpty ? "border-dashed" : ""}`}>
      {/* Status badge */}
      {statusConfig && (
        <div className="absolute top-3 right-3">
          <Badge variant={statusConfig.variant} className="flex items-center gap-1">
            {StatusIcon && <StatusIcon className="h-3 w-3" />}
            {statusConfig.label}
          </Badge>
        </div>
      )}

      {/* Draft indicator */}
      {hasDraft && isApproved && (
        <div className="absolute top-3 right-20">
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            Has Draft
          </Badge>
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${isEmpty ? "bg-muted" : "bg-primary/10"}`}>
            <Icon className={`h-5 w-5 ${isEmpty ? "text-muted-foreground" : "text-primary"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg">{label}</CardTitle>
            <CardDescription className="text-sm mt-1 line-clamp-2">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Content preview */}
        <div className="text-sm text-muted-foreground mb-4">
          {isEmpty ? (
            <span className="italic">Click Edit to configure this module</span>
          ) : (
            <span>{contentPreview}</span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Edit button */}
          {!isReadOnly && (
            <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-1" />
                  {isEmpty ? "Configure" : "Edit"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit {label}</DialogTitle>
                  <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <BrainModuleEditor
                  module={module}
                  document={document}
                  onClose={() => setEditorOpen(false)}
                />
              </DialogContent>
            </Dialog>
          )}

          {/* History button */}
          {document && (
            <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <History className="h-4 w-4 mr-1" />
                  History
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Version History - {label}</DialogTitle>
                  <DialogDescription>
                    View all previous versions of this module
                  </DialogDescription>
                </DialogHeader>
                <BrainVersionHistory documentId={document.id} />
              </DialogContent>
            </Dialog>
          )}

          {/* Approve button */}
          {canApprove && onApprove && (
            <Button variant="default" size="sm" onClick={onApprove}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve
            </Button>
          )}

          {/* AI Improve button */}
          {document && onImprove && (
            <Button variant="ghost" size="sm" onClick={onImprove}>
              <Sparkles className="h-4 w-4 mr-1" />
              Improve with AI
            </Button>
          )}
        </div>

        {/* Last updated */}
        {document?.updated_at && (
          <div className="text-xs text-muted-foreground mt-3 pt-3 border-t">
            Last updated: {new Date(document.updated_at).toLocaleDateString()} at{" "}
            {new Date(document.updated_at).toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
