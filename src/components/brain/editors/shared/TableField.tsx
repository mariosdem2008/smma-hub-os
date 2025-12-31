import { useState } from "react";
import { Plus, X, Edit2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Column {
  key: string;
  label: string;
  width?: string;
}

interface TableFieldProps {
  label: string;
  description?: string;
  columns: Column[];
  value: Record<string, string>[];
  onChange: (value: Record<string, string>[]) => void;
  className?: string;
}

export function TableField({
  label,
  description,
  columns,
  value = [],
  onChange,
  className,
}: TableFieldProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<Record<string, string>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newRow, setNewRow] = useState<Record<string, string>>(
    columns.reduce((acc, col) => ({ ...acc, [col.key]: "" }), {})
  );

  const handleAdd = () => {
    if (Object.values(newRow).some((v) => v.trim())) {
      onChange([...value, newRow]);
      setNewRow(columns.reduce((acc, col) => ({ ...acc, [col.key]: "" }), {}));
      setIsAdding(false);
    }
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditingRow({ ...value[index] });
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null) {
      const newValue = [...value];
      newValue[editingIndex] = editingRow;
      onChange(newValue);
      setEditingIndex(null);
      setEditingRow({});
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingRow({});
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {!isAdding && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Row
          </Button>
        )}
      </div>

      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} style={{ width: col.width }}>
                  {col.label}
                </TableHead>
              ))}
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {value.map((row, index) => (
              <TableRow key={index}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    {editingIndex === index ? (
                      <Input
                        value={editingRow[col.key] || ""}
                        onChange={(e) =>
                          setEditingRow({ ...editingRow, [col.key]: e.target.value })
                        }
                        className="h-8"
                      />
                    ) : (
                      <span className="text-sm">{row[col.key]}</span>
                    )}
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex items-center gap-1">
                    {editingIndex === index ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={handleSaveEdit}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={handleCancelEdit}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEdit(index)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleRemove(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {/* Add new row */}
            {isAdding && (
              <TableRow>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Input
                      value={newRow[col.key] || ""}
                      onChange={(e) =>
                        setNewRow({ ...newRow, [col.key]: e.target.value })
                      }
                      placeholder={col.label}
                      className="h-8"
                    />
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleAdd}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setIsAdding(false)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {value.length === 0 && !isAdding && (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="text-center text-muted-foreground py-4"
                >
                  No items yet. Click "Add Row" to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
