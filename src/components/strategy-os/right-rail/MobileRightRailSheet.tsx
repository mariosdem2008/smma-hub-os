// Strategy OS - Mobile Right Rail Sheet

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { RightRailPanel } from './RightRailPanel';
import { Bot } from 'lucide-react';

interface MobileRightRailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileRightRailSheet({ open, onOpenChange }: MobileRightRailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-xl">
        <SheetHeader className="px-4 py-3 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            Strategy Assistant
          </SheetTitle>
        </SheetHeader>
        <div className="h-[calc(100%-60px)]">
          <RightRailPanel />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default MobileRightRailSheet;
