import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Eye, Edit3, AlertTriangle, Save } from "lucide-react";
import {
  PERMISSION_SCOPES,
  CATEGORY_INFO,
  getScopesByCategory,
  type PermissionCategory,
  type AiPermissionsContent,
  getDefaultPermissions,
} from "@/lib/ai/aiPermissions";

interface AiPermissionsEditorProps {
  content: AiPermissionsContent | null;
  onSave: (content: AiPermissionsContent) => Promise<void>;
  readOnly?: boolean;
}

const CATEGORY_ICONS: Record<PermissionCategory, React.ReactNode> = {
  read: <Eye className="h-4 w-4" />,
  write: <Edit3 className="h-4 w-4" />,
  safety: <Shield className="h-4 w-4" />,
};

const CATEGORY_COLORS: Record<PermissionCategory, string> = {
  read: "bg-blue-500/10 text-blue-600 border-blue-200",
  write: "bg-amber-500/10 text-amber-600 border-amber-200",
  safety: "bg-red-500/10 text-red-600 border-red-200",
};

export function AiPermissionsEditor({ content, onSave, readOnly = false }: AiPermissionsEditorProps) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize permissions from content or defaults
  useEffect(() => {
    const initial: Record<string, boolean> = {};

    if (content) {
      // Set from content
      for (const scope of content.read_scopes) {
        initial[scope] = true;
      }
      for (const scope of content.write_scopes) {
        initial[scope] = true;
      }
      for (const scope of content.safety_scopes) {
        initial[scope] = true;
      }
      // Set remaining to false
      for (const scopeDef of PERMISSION_SCOPES) {
        if (!(scopeDef.scope in initial)) {
          initial[scopeDef.scope] = false;
        }
      }
    } else {
      // Use defaults
      for (const def of getDefaultPermissions()) {
        initial[def.scope] = def.enabled;
      }
    }

    setPermissions(initial);
    setHasChanges(false);
  }, [content]);

  const handleToggle = (scope: string) => {
    if (readOnly) return;

    setPermissions((prev) => {
      const newPermissions = { ...prev, [scope]: !prev[scope] };
      setHasChanges(true);
      return newPermissions;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newContent: AiPermissionsContent = {
        schema_version: 1,
        read_scopes: Object.entries(permissions)
          .filter(([scope, enabled]) => enabled && PERMISSION_SCOPES.find((s) => s.scope === scope)?.category === "read")
          .map(([scope]) => scope),
        write_scopes: Object.entries(permissions)
          .filter(([scope, enabled]) => enabled && PERMISSION_SCOPES.find((s) => s.scope === scope)?.category === "write")
          .map(([scope]) => scope),
        safety_scopes: Object.entries(permissions)
          .filter(([scope, enabled]) => enabled && PERMISSION_SCOPES.find((s) => s.scope === scope)?.category === "safety")
          .map(([scope]) => scope),
        updated_at: new Date().toISOString(),
      };

      await onSave(newContent);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Check for disabled critical safety permissions
  const disabledCriticalScopes = PERMISSION_SCOPES
    .filter((s) => s.isCritical && !permissions[s.scope])
    .map((s) => s.label);

  const categories: PermissionCategory[] = ["read", "write", "safety"];

  return (
    <div className="space-y-6">
      {disabledCriticalScopes.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> Critical safety permissions are disabled: {disabledCriticalScopes.join(", ")}
          </AlertDescription>
        </Alert>
      )}

      {categories.map((category) => (
        <div key={category} className="space-y-4">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${CATEGORY_COLORS[category]}`}>
              {CATEGORY_ICONS[category]}
            </div>
            <div>
              <h3 className="font-semibold">{CATEGORY_INFO[category].label}</h3>
              <p className="text-sm text-muted-foreground">{CATEGORY_INFO[category].description}</p>
            </div>
          </div>

          <div className="grid gap-3 pl-8">
            {getScopesByCategory(category).map((scopeDef) => (
              <div
                key={scopeDef.scope}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={scopeDef.scope} className="font-medium cursor-pointer">
                      {scopeDef.label}
                    </Label>
                    {scopeDef.isCritical && (
                      <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                        Critical
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{scopeDef.description}</p>
                </div>
                <Switch
                  id={scopeDef.scope}
                  checked={permissions[scopeDef.scope] ?? scopeDef.defaultEnabled}
                  onCheckedChange={() => handleToggle(scopeDef.scope)}
                  disabled={readOnly}
                />
              </div>
            ))}
          </div>

          {category !== "safety" && <Separator className="mt-4" />}
        </div>
      ))}

      {!readOnly && (
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Permissions"}
          </Button>
        </div>
      )}
    </div>
  );
}
