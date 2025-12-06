import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/hooks/useRole";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { hapticButton } from "@/lib/haptics";
import { Plus, Users, AlertCircle, ArrowRight, FileText, Video, MoreVertical, Edit, Trash2 } from "lucide-react";
import { PlanGuard } from "@/components/PlanGuard";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  created_at: string;
  logo_url: string | null;
  assetCount?: number;
  publishedVideoCount?: number;
}

export default function Clients() {
  const { user } = useAuth();
  const { canManageClients, role } = useRole();
  const { limits } = usePlanLimits();
  const { openUpgradeModal } = useUpgradeModal();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    status: "active",
  });
  const [editFormData, setEditFormData] = useState({
    id: "",
    name: "",
    email: "",
    phone: "",
    company: "",
    status: "active",
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);

  const isAtLimit = limits?.clients !== null && clients.length >= limits.clients;
  const isAdmin = role === "owner" || role === "admin";

  const fetchClients = async () => {
    if (!user) return;

    // Get user's agency relationship
    const { data: agencyData } = await supabase.from("agencies").select("id").eq("user_id", user.id).maybeSingle();

    let agencyId = agencyData?.id;

    // If user is not an agency owner, check if they're an agency member
    if (!agencyId) {
      const { data: memberData } = await supabase
        .from("agency_members")
        .select("agency_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!memberData) {
        setLoading(false);
        return;
      }
      agencyId = memberData.agency_id;
    }

    if (!agencyId) {
      setLoading(false);
      return;
    }

    // Get clients with counts
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, email, phone, company, status, created_at, logo_url")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch clients",
        variant: "destructive",
      });
    } else {
      // Get asset counts for each client
      const clientsWithCounts = await Promise.all(
        (data || []).map(async (client) => {
          // Total assets count
          const { count: assetCount } = await supabase
            .from("assets")
            .select("*", { count: "exact", head: true })
            .eq("client_id", client.id);

          // Published videos count
          const { count: publishedVideoCount } = await supabase
            .from("assets")
            .select("*", { count: "exact", head: true })
            .eq("client_id", client.id)
            .eq("status", "published")
            .like("file_type", "video%");

          return {
            ...client,
            assetCount: assetCount || 0,
            publishedVideoCount: publishedVideoCount || 0,
          };
        }),
      );
      setClients(clientsWithCounts);
    }

    setLoading(false);
  };

  // Pull-to-refresh
  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await fetchClients();
    },
  });

  useEffect(() => {
    fetchClients();
  }, [user]);

  const handleCreateClient = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Client name is required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Get user's agency relationship
      const { data: agencyData } = await supabase.from("agencies").select("id").eq("user_id", user?.id).maybeSingle();

      let agencyId = agencyData?.id;

      // If user is not an agency owner, check if they're an agency member
      if (!agencyId) {
        const { data: memberData } = await supabase
          .from("agency_members")
          .select("agency_id")
          .eq("user_id", user?.id)
          .maybeSingle();

        if (!memberData) {
          toast({
            title: "Error",
            description: "You are not associated with any agency",
            variant: "destructive",
          });
          return;
        }
        agencyId = memberData.agency_id;
      }

      if (!agencyId) {
        toast({
          title: "Error",
          description: "Could not determine agency. Please contact support.",
          variant: "destructive",
        });
        return;
      }

      // Create client with proper data - let Supabase generate the ID
      const clientData = {
        agency_id: agencyId,
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        company: formData.company.trim() || null,
        status: formData.status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log("Creating client with data:", clientData);

      const { data: newClient, error } = await supabase.from("clients").insert(clientData).select().single();

      if (error) {
        console.error("Supabase error details:", error);

        // Try alternative approach if the first one fails
        if (error.code === "23502") {
          // NOT NULL constraint violation
          // Generate a UUID for the client
          const clientId = crypto.randomUUID();
          const clientDataWithId = {
            id: clientId,
            ...clientData,
          };

          console.log("Retrying with generated ID:", clientId);

          const { data: retryClient, error: retryError } = await supabase
            .from("clients")
            .insert(clientDataWithId)
            .select()
            .single();

          if (retryError) {
            console.error("Retry error:", retryError);
            throw retryError;
          }

          toast({
            title: "Success",
            description: "Client created successfully",
          });

          setShowDialog(false);
          setFormData({ name: "", email: "", phone: "", company: "", status: "active" });

          // Navigate to new client
          navigate(`/clients/${retryClient.id}`);
          return;
        }

        throw error;
      }

      toast({
        title: "Success",
        description: "Client created successfully",
      });

      setShowDialog(false);
      setFormData({ name: "", email: "", phone: "", company: "", status: "active" });

      // Navigate to new client
      navigate(`/clients/${newClient.id}`);
    } catch (error: any) {
      console.error("Error creating client:", error);

      let errorMessage = "Failed to create client";
      if (error.message) {
        errorMessage = error.message;
      } else if (error.details) {
        errorMessage = error.details;
      } else if (error.hint) {
        errorMessage = error.hint;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (client: Client) => {
    setEditFormData({
      id: client.id,
      name: client.name,
      email: client.email || "",
      phone: client.phone || "",
      company: client.company || "",
      status: client.status,
    });
    setShowEditDialog(true);
  };

  const handleSaveChanges = async () => {
    if (!editFormData.name.trim()) {
      toast({
        title: "Error",
        description: "Client name is required",
        variant: "destructive",
      });
      return;
    }

    setSavingChanges(true);

    try {
      const updates = {
        name: editFormData.name.trim(),
        email: editFormData.email.trim() || null,
        phone: editFormData.phone.trim() || null,
        company: editFormData.company.trim() || null,
        status: editFormData.status,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("clients").update(updates).eq("id", editFormData.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client updated successfully",
      });

      setShowEditDialog(false);
      await fetchClients();
    } catch (error) {
      console.error("Error updating client:", error);
      toast({
        title: "Error",
        description: "Failed to update client",
        variant: "destructive",
      });
    } finally {
      setSavingChanges(false);
    }
  };

  const handleDeleteClick = (client: Client) => {
    setEditFormData({
      id: client.id,
      name: client.name,
      email: client.email || "",
      phone: client.phone || "",
      company: client.company || "",
      status: client.status,
    });
    setShowDeleteDialog(true);
  };

  const handleDeleteClient = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_client_cascade", {
        p_client_id: editFormData.id,
      });

      if (error) throw error;

      toast({
        title: "Client deleted",
        description: "The client and all related data were deleted.",
      });

      setShowDeleteDialog(false);
      await fetchClients();
    } catch (error: any) {
      console.error("Delete client error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete client",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-status-active";
      case "inactive":
        return "bg-status-inactive";
      case "paused":
        return "bg-status-paused";
      default:
        return "bg-muted";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div
      className="space-y-4 md:space-y-6"
      style={{
        transform: isMobile ? `translateY(${pullDistance}px)` : undefined,
        transition: isRefreshing ? "transform 0.3s ease-out" : "none",
      }}
    >
      {/* Pull-to-refresh indicator */}
      {isMobile && pullDistance > 0 && (
        <div className="flex justify-center">
          <div
            className={`text-sm text-muted-foreground transition-opacity ${pullDistance > 60 ? "opacity-100" : "opacity-50"}`}
          >
            {isRefreshing ? "Refreshing..." : pullDistance > 60 ? "Release to refresh" : "Pull to refresh"}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Clients</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage your client accounts</p>
        </div>
        {canManageClients && (
          <PlanGuard feature="clients" requiredPlan="starter">
            <Button
              onClick={() => {
                hapticButton();
                isAtLimit ? openUpgradeModal({ feature: "More clients" }) : setShowDialog(true);
              }}
              className="w-full md:w-auto"
              style={{ minHeight: isMobile ? "44px" : undefined }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </PlanGuard>
        )}
      </div>

      {/* Upgrade Prompt - Client Limit Reached */}
      {isAtLimit && (
        <Card className="border-primary bg-primary/5 animate-fade-in">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">You've reached your client limit</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upgrade your plan to manage more clients and scale your agency.
                </p>
                <Button onClick={() => openUpgradeModal({ feature: "More clients" })} size="sm">
                  Upgrade Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No clients yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {canManageClients ? "Get started by adding your first client" : "No clients have been added yet"}
            </p>
            {canManageClients && (
              <Button onClick={() => setShowDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Client
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <div key={client.id} className="relative group">
              <Link to={`/clients/${client.id}`} className="block">
                <Card className="hover:bg-card/80 cursor-pointer touch-manipulation">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 md:h-12 md:w-12">
                        <AvatarImage src={client.logo_url || undefined} alt={client.name} />
                        <AvatarFallback>{client.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="truncate text-base md:text-lg">{client.name}</CardTitle>
                        {client.company && (
                          <CardDescription className="truncate text-xs md:text-sm">{client.company}</CardDescription>
                        )}
                      </div>
                      <Badge
                        className={getStatusColor(client.status)}
                        style={{ fontSize: isMobile ? "10px" : undefined }}
                      >
                        {client.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        <span>{client.assetCount || 0} assets</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Video className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        <span>{client.publishedVideoCount || 0} published</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>

              {/* Admin actions dropdown */}
              {isAdmin && (
                <div className="absolute top-3 right-3 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
                        onClick={(e) => e.preventDefault()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          handleEditClick(client);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Client
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteClick(client);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Client
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Client Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className={isMobile ? "max-h-[85vh] overflow-y-auto" : ""}>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>Create a new client workspace for your agency</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 md:space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm">
                Client Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter client name"
                style={{ minHeight: isMobile ? "44px" : undefined }}
                className="touch-manipulation"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-sm">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="client@example.com"
                style={{ minHeight: isMobile ? "44px" : undefined }}
                className="touch-manipulation"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-sm">
                Phone
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 234 567 8900"
                style={{ minHeight: isMobile ? "44px" : undefined }}
                className="touch-manipulation"
              />
            </div>
            <div>
              <Label htmlFor="company" className="text-sm">
                Company
              </Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Company name"
                style={{ minHeight: isMobile ? "44px" : undefined }}
                className="touch-manipulation"
              />
            </div>
            <div>
              <Label htmlFor="status" className="text-sm">
                Status
              </Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger style={{ minHeight: isMobile ? "44px" : undefined }} className="touch-manipulation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                hapticButton();
                setShowDialog(false);
              }}
              disabled={submitting}
              style={{ minHeight: isMobile ? "44px" : undefined }}
              className="touch-manipulation"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                hapticButton();
                handleCreateClient();
              }}
              disabled={submitting}
              style={{ minHeight: isMobile ? "44px" : undefined }}
              className="touch-manipulation"
            >
              {submitting ? "Creating..." : "Create Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className={isMobile ? "max-h-[85vh] overflow-y-auto" : ""}>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update client information</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 md:space-y-4">
            <div>
              <Label htmlFor="edit-name" className="text-sm">
                Client Name *
              </Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                placeholder="Enter client name"
                style={{ minHeight: isMobile ? "44px" : undefined }}
                className="touch-manipulation"
              />
            </div>
            <div>
              <Label htmlFor="edit-email" className="text-sm">
                Email
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                placeholder="client@example.com"
                style={{ minHeight: isMobile ? "44px" : undefined }}
                className="touch-manipulation"
              />
            </div>
            <div>
              <Label htmlFor="edit-phone" className="text-sm">
                Phone
              </Label>
              <Input
                id="edit-phone"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                placeholder="+1 234 567 8900"
                style={{ minHeight: isMobile ? "44px" : undefined }}
                className="touch-manipulation"
              />
            </div>
            <div>
              <Label htmlFor="edit-company" className="text-sm">
                Company
              </Label>
              <Input
                id="edit-company"
                value={editFormData.company}
                onChange={(e) => setEditFormData({ ...editFormData, company: e.target.value })}
                placeholder="Company name"
                style={{ minHeight: isMobile ? "44px" : undefined }}
                className="touch-manipulation"
              />
            </div>
            <div>
              <Label htmlFor="edit-status" className="text-sm">
                Status
              </Label>
              <Select
                value={editFormData.status}
                onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
              >
                <SelectTrigger style={{ minHeight: isMobile ? "44px" : undefined }} className="touch-manipulation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                hapticButton();
                setShowEditDialog(false);
              }}
              disabled={savingChanges}
              style={{ minHeight: isMobile ? "44px" : undefined }}
              className="touch-manipulation"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                hapticButton();
                handleSaveChanges();
              }}
              disabled={savingChanges}
              style={{ minHeight: isMobile ? "44px" : undefined }}
              className="touch-manipulation"
            >
              {savingChanges ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Client Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the client "{editFormData.name}" and all
              associated data including assets, uploads, comments, and messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClient}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Client"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
