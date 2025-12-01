import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { AIAssistant } from "@/components/pipeline/AIAssistant";

interface Script {
  id: string;
  title: string;
  hook: string | null;
  script_body: string | null;
  cta: string | null;
  editor_notes: string | null;
  idea_id: string | null;
  status: string;
}

interface Idea {
  id: string;
  title: string;
}

interface ScriptEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  script: Script | null;
  clientId: string;
  ideas: Idea[];
  onSave: () => void;
}

export default function ScriptEditor({
  open,
  onOpenChange,
  script,
  clientId,
  ideas,
  onSave,
}: ScriptEditorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: script?.title || "",
    hook: script?.hook || "",
    script_body: script?.script_body || "",
    cta: script?.cta || "",
    editor_notes: script?.editor_notes || "",
    idea_id: script?.idea_id || "",
  });

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Script title is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const scriptData = {
        title: formData.title,
        hook: formData.hook || null,
        script_body: formData.script_body || null,
        cta: formData.cta || null,
        editor_notes: formData.editor_notes || null,
        idea_id: formData.idea_id || null,
        client_id: clientId,
      };

      if (script) {
        // Update existing script
        const { error } = await supabase
          .from("scripts")
          .update(scriptData)
          .eq("id", script.id);

        if (error) throw error;

        toast({
          title: "Script Updated",
          description: "Script has been updated successfully",
        });
      } else {
        // Create new script
        const { error } = await supabase
          .from("scripts")
          .insert(scriptData);

        if (error) throw error;

        toast({
          title: "Script Created",
          description: "New script has been created successfully",
        });
      }

      onSave();
      onOpenChange(false);
      setFormData({
        title: "",
        hook: "",
        script_body: "",
        cta: "",
        editor_notes: "",
        idea_id: "",
      });
    } catch (error) {
      console.error("Error saving script:", error);
      toast({
        title: "Error",
        description: "Failed to save script",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>{script ? "Edit Script" : "Create New Script"}</DialogTitle>
            <AIAssistant
              projectId=""
              clientId={clientId}
              onGenerateIdea={() => {}}
              onGenerateHook={(hook) => {
                setFormData({ ...formData, hook });
                toast({
                  title: "Hook Generated",
                  description: "AI hook added to your script",
                });
              }}
              onGenerateScript={(generatedScript) => {
                setFormData({ ...formData, script_body: generatedScript });
                toast({
                  title: "Script Generated",
                  description: "AI script added to script body",
                });
              }}
              onImproveScript={(improvedScript) => {
                setFormData({ ...formData, script_body: improvedScript });
                toast({
                  title: "Script Improved",
                  description: "AI improvements applied to script body",
                });
              }}
              onGenerateCaption={() => {}}
              onImproveCaption={() => {}}
            />
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Script Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Morning Routine Hook Script"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="idea">Link to Idea (Optional)</Label>
            <div className="flex gap-2">
              <Select
                value={formData.idea_id || undefined}
                onValueChange={(value) => setFormData({ ...formData, idea_id: value })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select an idea (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {ideas.map((idea) => (
                    <SelectItem key={idea.id} value={idea.id}>
                      {idea.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.idea_id && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData({ ...formData, idea_id: "" })}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hook">Hook</Label>
            <Textarea
              id="hook"
              placeholder="Opening hook to grab attention..."
              value={formData.hook}
              onChange={(e) => setFormData({ ...formData, hook: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="script_body">Script Body</Label>
            <Textarea
              id="script_body"
              placeholder="Main script content..."
              value={formData.script_body}
              onChange={(e) => setFormData({ ...formData, script_body: e.target.value })}
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cta">Call to Action</Label>
            <Textarea
              id="cta"
              placeholder="Clear call to action..."
              value={formData.cta}
              onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editor_notes">Notes for Editor</Label>
            <Textarea
              id="editor_notes"
              placeholder="Special instructions, b-roll notes, music preferences..."
              value={formData.editor_notes}
              onChange={(e) => setFormData({ ...formData, editor_notes: e.target.value })}
              rows={4}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {script ? "Update Script" : "Create Script"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
