import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ClientSummary = {
  id: string;
  name: string;
  company?: string | null;
};

type ClientPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ClientSummary[];
  onSelect: (clientId: string) => void;
};

export function ClientPickerDialog({
  open,
  onOpenChange,
  clients,
  onSelect,
}: ClientPickerDialogProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return clients;
    return clients.filter((client) => {
      const name = client.name?.toLowerCase() ?? "";
      const company = client.company?.toLowerCase() ?? "";
      return name.includes(normalizedQuery) || company.includes(normalizedQuery);
    });
  }, [clients, normalizedQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select a client</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Search by name or company"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="max-h-72 space-y-2 overflow-auto">
            {filtered.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                No clients match your search.
              </div>
            ) : (
              filtered.map((client) => (
                <Button
                  key={client.id}
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => {
                    onSelect(client.id);
                    onOpenChange(false);
                  }}
                >
                  <span className="truncate text-left">{client.name}</span>
                  <span className="ml-3 truncate text-xs text-muted-foreground">
                    {client.company || "—"}
                  </span>
                </Button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
