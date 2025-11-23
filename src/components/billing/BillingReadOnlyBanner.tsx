import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export function BillingReadOnlyBanner() {
  return (
    <Alert className="mb-6 border-primary/20 bg-primary/5">
      <Info className="h-4 w-4 text-primary" />
      <AlertDescription>
        You have read-only access to billing information. Only the agency owner can manage billing and subscriptions.
      </AlertDescription>
    </Alert>
  );
}
