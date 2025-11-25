import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, ChevronUp, ChevronDown, UserCheck, Edit2, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ApprovalWorkflow {
  id: string;
  client_id: string;
  approver_id: string;
  approver_order: number;
  role_name: string | null;
  created_at: string;
  updated_at: string;
}

interface Approver {
  id: string;
  email: string;
  full_name: string | null;
}

interface ApprovalWorkflowManagerProps {
  clientId: string;
  isClientPortal?: boolean;
}

export default function ApprovalWorkflowManager({ 
  clientId, 
  isClientPortal = false 
}: ApprovalWorkflowManagerProps) {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [availableApprovers, setAvailableApprovers] = useState<Approver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApproverId, setSelectedApproverId] = useState<string>("");
  const [roleName, setRoleName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleName, setEditingRoleName] = useState("");

  useEffect(() => {
    fetchWorkflows();
    fetchAvailableApprovers();
  }, [clientId]);

  const fetchWorkflows = async () => {
    const { data, error } = await supabase
      .from('client_approval_workflows')
      .select('*')
      .eq('client_id', clientId)
      .order('approver_order', { ascending: true });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load approval workflows",
        variant: "destructive"
      });
    } else {
      setWorkflows(data || []);
    }
    setLoading(false);
  };

  const fetchAvailableApprovers = async () => {
    if (isClientPortal) {
      // Fetch client users for client portal
      const { data, error } = await supabase
        .from('client_users')
        .select('id, email, full_name')
        .eq('client_id', clientId);

      if (!error && data) {
        setAvailableApprovers(data);
      }
    } else {
      // Fetch agency members for agency side
      const { data: client } = await supabase
        .from('clients')
        .select('agency_id')
        .eq('id', clientId)
        .single();

      if (client) {
        const { data: members } = await supabase
          .from('agency_members')
          .select('user_id')
          .eq('agency_id', client.agency_id);

        if (members) {
          const userIds = members.map(m => m.user_id);
          
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email, full_name')
            .in('id', userIds);

          if (profiles) {
            setAvailableApprovers(profiles);
          }
        }
      }
    }
  };

  const handleAddApprover = async () => {
    if (!selectedApproverId) {
      toast({
        title: "Error",
        description: "Please select an approver",
        variant: "destructive"
      });
      return;
    }

    const maxOrder = workflows.length > 0 
      ? Math.max(...workflows.map(w => w.approver_order))
      : 0;

    const { error } = await supabase
      .from('client_approval_workflows')
      .insert({
        client_id: clientId,
        approver_id: selectedApproverId,
        approver_order: maxOrder + 1,
        role_name: roleName || null
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add approver",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Approver added to workflow"
      });
      setSelectedApproverId("");
      setRoleName("");
      fetchWorkflows();
    }
  };

  const handleRemoveApprover = async (workflowId: string) => {
    const { error } = await supabase
      .from('client_approval_workflows')
      .delete()
      .eq('id', workflowId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove approver",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Approver removed from workflow"
      });
      fetchWorkflows();
    }
    setDeleteDialogOpen(false);
    setWorkflowToDelete(null);
  };

  const handleReorder = async (workflowId: string, direction: 'up' | 'down') => {
    const currentWorkflow = workflows.find(w => w.id === workflowId);
    if (!currentWorkflow) return;

    const currentOrder = currentWorkflow.approver_order;
    const targetOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;
    const targetWorkflow = workflows.find(w => w.approver_order === targetOrder);

    if (!targetWorkflow) return;

    // Swap orders
    const updates = [
      supabase
        .from('client_approval_workflows')
        .update({ approver_order: targetOrder })
        .eq('id', currentWorkflow.id),
      supabase
        .from('client_approval_workflows')
        .update({ approver_order: currentOrder })
        .eq('id', targetWorkflow.id)
    ];

    const results = await Promise.all(updates);
    
    if (results.some(r => r.error)) {
      toast({
        title: "Error",
        description: "Failed to reorder approvers",
        variant: "destructive"
      });
    } else {
      fetchWorkflows();
    }
  };

  const handleStartEditRole = (workflow: ApprovalWorkflow) => {
    setEditingRoleId(workflow.id);
    setEditingRoleName(workflow.role_name || "");
  };

  const handleSaveRole = async (workflowId: string) => {
    const { error } = await supabase
      .from('client_approval_workflows')
      .update({ role_name: editingRoleName || null })
      .eq('id', workflowId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update role name",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Role name updated"
      });
      setEditingRoleId(null);
      setEditingRoleName("");
      fetchWorkflows();
    }
  };

  const handleCancelEditRole = () => {
    setEditingRoleId(null);
    setEditingRoleName("");
  };

  const getApproverName = (approverId: string) => {
    const approver = availableApprovers.find(a => a.id === approverId);
    return approver?.full_name || approver?.email || 'Unknown';
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Approval Workflow
          </CardTitle>
          <CardDescription>
            Define the approval chain for content. Approvers will review assets in order.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Workflow */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Current Approval Chain</Label>
            {workflows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No approvers configured yet</p>
                <p className="text-sm">Add approvers below to set up your workflow</p>
              </div>
            ) : (
              <div className="space-y-2">
                {workflows.map((workflow, index) => (
                  <div
                    key={workflow.id}
                    className="flex items-center gap-3 p-3 border rounded-lg bg-card"
                  >
                    <Badge variant="outline" className="font-mono">
                      {index + 1}
                    </Badge>

                    <div className="flex-1">
                      <div className="font-medium">
                        {getApproverName(workflow.approver_id)}
                      </div>
                      {editingRoleId === workflow.id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            value={editingRoleName}
                            onChange={(e) => setEditingRoleName(e.target.value)}
                            placeholder="Role name (optional)"
                            className="h-7 text-sm"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSaveRole(workflow.id)}
                            className="h-7 w-7 p-0"
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEditRole}
                            className="h-7 w-7 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {workflow.role_name || "No role specified"}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEditRole(workflow)}
                            className="h-6 w-6 p-0"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReorder(workflow.id, 'up')}
                        disabled={index === 0}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReorder(workflow.id, 'down')}
                        disabled={index === workflows.length - 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setWorkflowToDelete(workflow.id);
                          setDeleteDialogOpen(true);
                        }}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Approver */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-base font-semibold">Add Approver</Label>
            <div className="flex flex-col gap-3">
              <div className="space-y-2">
                <Label htmlFor="approver">Select Approver</Label>
                <Select
                  value={selectedApproverId}
                  onValueChange={setSelectedApproverId}
                >
                  <SelectTrigger id="approver">
                    <SelectValue placeholder="Choose an approver" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableApprovers
                      .filter(a => !workflows.some(w => w.approver_id === a.id))
                      .map(approver => (
                        <SelectItem key={approver.id} value={approver.id}>
                          {approver.full_name || approver.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role Name (optional)</Label>
                <Input
                  id="role"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g., Marketing Director, Creative Lead"
                />
              </div>

              <Button onClick={handleAddApprover} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add to Workflow
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Approver</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this approver from the workflow? This will affect future approvals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => workflowToDelete && handleRemoveApprover(workflowToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}