import { useState } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ArrayFieldProps {
  label: string;
  description?: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  multiline?: boolean;
  maxItems?: number;
  className?: string;
}

export function ArrayField({
  label,
  description,
  value = [],
  onChange,
  placeholder = "Add item...",
  multiline = false,
  maxItems,
  className,
}: ArrayFieldProps) {
  const [newItem, setNewItem] = useState("");

  const handleAdd = () => {
    if (newItem.trim() && (!maxItems || value.length < maxItems)) {
      onChange([...value, newItem.trim()]);
      setNewItem("");
    }
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>

      {/* Existing items */}
      <div className="space-y-2">
        {value.map((item, index) => (
          <div
            key={index}
            className="flex items-start gap-2 group bg-muted/30 rounded-md p-2"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground mt-1 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="flex-1 text-sm break-words">{item}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleRemove(index)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add new item */}
      {(!maxItems || value.length < maxItems) && (
        <div className="flex gap-2">
          {multiline ? (
            <Textarea
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder={placeholder}
              className="flex-1 min-h-[60px]"
              onKeyDown={handleKeyDown}
            />
          ) : (
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder={placeholder}
              className="flex-1"
              onKeyDown={handleKeyDown}
            />
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAdd}
            disabled={!newItem.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {maxItems && (
        <p className="text-xs text-muted-foreground">
          {value.length}/{maxItems} items
        </p>
      )}
    </div>
  );
}
