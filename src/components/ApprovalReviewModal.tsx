import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle } from "lucide-react";

interface ApprovalReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: 'post' | 'idea';
  contentTitle: string;
  action: 'approve' | 'reject';
  onSubmit: (comment: string) => Promise<void>;
}

export default function ApprovalReviewModal({
  open,
  onOpenChange,
  contentType,
  contentTitle,
  action,
  onSubmit,
}: ApprovalReviewModalProps) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(comment);
      setComment("");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const isApprove = action === 'approve';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isApprove ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                Approve {contentType}
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-destructive" />
                Reject {contentType}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isApprove
              ? `Approve "${contentTitle}" for publication?`
              : `Reject "${contentTitle}" and request changes?`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="comment">
              {isApprove ? "Comment (optional)" : "Reason for rejection"}
            </Label>
            <Textarea
              id="comment"
              placeholder={isApprove 
                ? "Add any additional notes..." 
                : "Explain what needs to be changed..."}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant={isApprove ? "default" : "destructive"}
            onClick={handleSubmit}
            disabled={submitting || (!isApprove && !comment.trim())}
          >
            {submitting ? "Processing..." : isApprove ? "Approve" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
