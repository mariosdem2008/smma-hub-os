import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';

interface NoPermissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NoPermissionModal({ open, onOpenChange }: NoPermissionModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-destructive" />
            <DialogTitle>Access Denied</DialogTitle>
          </div>
          <DialogDescription>
            You don't have permission to view this page.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Only agency owners and admins can access billing settings. If you need to view billing information
            or request a plan upgrade, please contact your agency owner.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="default">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
