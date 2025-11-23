import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface ContactOwnerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
}

export function ContactOwnerModal({ open, onOpenChange, feature }: ContactOwnerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            <DialogTitle>Contact Your Agency Owner</DialogTitle>
          </div>
          <DialogDescription>
            Only your agency owner can upgrade your plan.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-3">
          {feature && (
            <p className="text-sm">
              The feature <span className="font-semibold">"{feature}"</span> requires a plan upgrade.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Please reach out to your agency owner to request a plan upgrade. They have full access to billing
            settings and can make the necessary changes.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="default">
            Understood
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
