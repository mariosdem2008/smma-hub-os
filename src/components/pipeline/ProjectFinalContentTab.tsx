import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Video,
  Image as ImageIcon,
  AlertCircle,
  Upload,
  X,
  Calendar as CalendarIcon,
  Lightbulb,
  Send,
  Loader2,
  Clock,
  Info,
  Globe,
  ExternalLink,
  Sparkles,
  Wand2,
  PenTool,
  FileText,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { getAllPlatformSuggestions } from "@/lib/platform-posting-times";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { convertToUTC, convertToLocal } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { logActivity } from "@/hooks/useActivityLog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AIGenerateModal } from "./AIGenerateModal";
import { useNavigate } from "react-router-dom";

interface Project {
  id: string;
  client_id: string;
  final_asset_id: string | null;
  platforms: string[];
  platform_captions: Record<string, string>;
  hashtags: string | null;
  scheduled_time: string | null;
  status: string | null;
  published_urls: Record<string, string> | null;
  error_message: string | null;
}

interface Asset {
  id: string;
  filename: string;
  file_url: string;
  file_type: string;
}

const PLATFORMS = [
  { id: "instagram", label: "Instagram", enabled: true },
  { id: "facebook", label: "Facebook", enabled: true },
  { id: "tiktok", label: "TikTok", enabled: false },
  { id: "linkedin", label: "LinkedIn", enabled: false },
];

const PLATFORM_LIMITS = {
  tiktok: 2200,
  instagram: 2200,
  youtube: 5000,
  facebook: 63206,
  linkedin: 3000,
};

interface ProjectFinalContentTabProps {
  project: Project;
  onUpdate: () => void;
}

export default function ProjectFinalContentTab({ project, onUpdate }: ProjectFinalContentTabProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [finalAssets, setFinalAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(project.platforms || []);
  const [captions, setCaptions] = useState<Record<string, string>>(project.platform_captions || {});
  const [hashtags, setHashtags] = useState(project.hashtags || "");
  const [userTimezone, setUserTimezone] = useState<string>("UTC");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    project.scheduled_time ? new Date(project.scheduled_time) : undefined,
  );
  const [scheduledTime, setScheduledTime] = useState<string>(
    project.scheduled_time ? format(new Date(project.scheduled_time), "HH:mm") : "12:00",
  );
  const [activeAIModal, setActiveAIModal] = useState<string | null>(null);
  const [aiVariants, setAiVariants] = useState<Array<{ caption: string; length: string; platform?: string }>>([]);
  const [showVariants, setShowVariants] = useState(false);
  const [generatingAI, setGeneratingAI] = useState<Record<string, boolean>>({});

  const readFunctionErrorPayload = async (error: unknown): Promise<{ code?: string; error?: string; deep_link?: string } | null> => {
    if (!error || typeof error !== "object") return null;
    const context = (error as { context?: Response }).context;
    if (!context || typeof (context as any).json !== "function") return null;
    try {
      return await (context as any).json();
    } catch {
      return null;
    }
  };

  useEffect(() => {
    fetchFinalAssets();
    fetchUserTimezone();
  }, [project.id]);

  useEffect(() => {
    if (project.scheduled_time && userTimezone !== "UTC") {
      const localDate = convertToLocal(project.scheduled_time, userTimezone);
      setScheduledDate(localDate);
      setScheduledTime(format(localDate, "HH:mm"));
    }
  }, [project.scheduled_time, userTimezone]);

  const fetchUserTimezone = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.from("profiles").select("timezone").eq("id", user.id).single();

      if (error) {
        const payload = await readFunctionErrorPayload(error);
        if (payload?.code === "STRATEGY_APPROVAL_REQUIRED" || payload?.code === "AGENT_ACTIVATION_REQUIRED") {
          toast({
            title: payload.code === "AGENT_ACTIVATION_REQUIRED" ? "Creator activation required" : "Strategy approval required",
            description:
              payload.error ||
              (payload.code === "AGENT_ACTIVATION_REQUIRED"
                ? "Activate the creator agent in AI Setup before generating captions."
                : "Approve the current recommendation and strategy plan before generating captions."),
            variant: "destructive",
          });
          if (payload.deep_link) navigate(payload.deep_link);
          return;
        }
        throw error;
      }
      if (data?.timezone) {
        setUserTimezone(data.timezone);
      }
    } catch (error) {
      console.error("Error fetching timezone:", error);
    }
  };

  const fetchFinalAssets = async () => {
    try {
      const { data, error } = await supabase
        .from("project_assets")
        .select("asset_id, assets(id, filename, file_url, file_type)")
        .eq("project_id", project.id)
        .eq("is_final_content", true);

      if (error) throw error;

      const assets = data?.map((pa: any) => pa.assets).filter(Boolean) as Asset[];

      setFinalAssets(assets || []);
    } catch (error) {
      console.error("Error fetching final assets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${project.client_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from("client-assets").upload(filePath, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("client-assets").getPublicUrl(filePath);

        const fileType = file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/")
            ? "video"
            : "document";

        const { data: asset, error: assetError } = await supabase
          .from("assets")
          .insert({
            client_id: project.client_id,
            filename: file.name,
            file_url: publicUrl,
            file_type: fileType,
            file_size: file.size,
          })
          .select()
          .single();

        if (assetError) throw assetError;

        const { error: linkError } = await supabase.from("project_assets").insert({
          project_id: project.id,
          asset_id: asset.id,
          is_final_content: true,
        });

        if (linkError) throw linkError;
      }

      toast({
        title: "Success",
        description: "Final content uploaded successfully",
      });

      await logActivity({
        projectId: project.id,
        actionType: "final_asset_uploaded",
        details: {
          file_count: files.length,
        },
      });

      fetchFinalAssets();
      onUpdate();
    } catch (error) {
      console.error("Error uploading files:", error);
      toast({
        title: "Error",
        description: "Failed to upload final content",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFinalAsset = async (assetId: string) => {
    try {
      const { error } = await supabase
        .from("project_assets")
        .update({ is_final_content: false })
        .eq("project_id", project.id)
        .eq("asset_id", assetId);

      if (error) throw error;

      toast({
        title: "Removed",
        description: "Asset removed from final content",
      });

      fetchFinalAssets();
      onUpdate();
    } catch (error) {
      console.error("Error removing final asset:", error);
      toast({
        title: "Error",
        description: "Failed to remove asset",
        variant: "destructive",
      });
    }
  };

  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId) ? prev.filter((p) => p !== platformId) : [...prev, platformId],
    );
  };

  const handleGenerateCaption = async (platformId?: string) => {
    if (selectedPlatforms.length === 0) {
      toast({
        title: "Select platforms first",
        description: "Please select at least one platform",
        variant: "destructive",
      });
      return;
    }

    const platformsToGenerate = platformId ? [platformId] : selectedPlatforms;

    setGeneratingAI((prev) => ({
      ...prev,
      [platformId || "all"]: true,
    }));

    try {
      const platform = platformId || selectedPlatforms[0];

      const { data, error } = await supabase.functions.invoke("generate-ai-content", {
        body: {
          mode: "caption", // Use 'caption' mode (matches edge function)
          project_id: project.id,
          client_id: project.client_id,
          platform: platform,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Failed to generate captions");
      }

      if (platformId && data.suggestions && data.suggestions.length > 0) {
        // If generating for a specific platform, show variants for that platform
        const variants = data.suggestions.map((suggestion: any) => ({
          caption: suggestion.text || suggestion,
          length: suggestion.text ? `~${suggestion.text.length} chars` : "~200 chars",
          platform: platformId,
        }));
        setAiVariants(variants);
        setShowVariants(true);
      } else if (data.suggestions && data.suggestions.length > 0) {
        // If generating for all platforms, apply the first suggestion to each platform
        const variantsByPlatform: Record<string, string> = {};

        selectedPlatforms.forEach((platform, index) => {
          const suggestion = data.suggestions[index] || data.suggestions[0];
          if (suggestion) {
            variantsByPlatform[platform] = suggestion.text || suggestion;
          }
        });

        setCaptions((prev) => ({
          ...prev,
          ...variantsByPlatform,
        }));

        toast({
          title: "Captions generated",
          description: `AI captions applied to ${selectedPlatforms.length} platform(s)`,
        });
      }
    } catch (error: any) {
      console.error("AI generation error:", error);
      toast({
        title: "Error generating captions",
        description: error.message || "Failed to generate captions",
        variant: "destructive",
      });
    } finally {
      setGeneratingAI((prev) => ({
        ...prev,
        [platformId || "all"]: false,
      }));
    }
  };

  const applyAIVariant = (variant: { caption: string; length: string; platform?: string }) => {
    if (variant.platform) {
      // Apply to specific platform
      setCaptions((prev) => ({
        ...prev,
        [variant.platform!]: variant.caption,
      }));
      toast({
        title: "Caption applied",
        description: `AI-generated caption applied to ${variant.platform}`,
      });
    } else {
      // Apply to all selected platforms
      const updatedCaptions = { ...captions };
      selectedPlatforms.forEach((platform) => {
        updatedCaptions[platform] = variant.caption;
      });
      setCaptions(updatedCaptions);
      toast({
        title: "Caption applied",
        description: `AI-generated caption applied to all platforms`,
      });
    }
    setShowVariants(false);
  };

  const handleAIGenerateComplete = (type: string, result: any) => {
    switch (type) {
      case "captions":
      case "improve-caption":
        if (result && typeof result === "object") {
          setCaptions((prev) => ({
            ...prev,
            ...result,
          }));
          toast({
            title: "Captions updated",
            description: "AI-generated captions have been applied",
          });
        }
        break;
      case "ideas":
        // Handle ideas generation if needed
        break;
      case "hooks":
        // Handle hooks generation if needed
        break;
      case "script":
        // Handle script generation if needed
        break;
      case "improve-script":
        // Handle script improvement if needed
        break;
    }
    setActiveAIModal(null);
  };

  const getCharacterLimit = (platformId: string) => {
    return PLATFORM_LIMITS[platformId as keyof typeof PLATFORM_LIMITS] || 2200;
  };

  const handleSchedulePost = async () => {
    if (!scheduledDate) {
      toast({
        title: "Missing information",
        description: "Please select a date for scheduling",
        variant: "destructive",
      });
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast({
        title: "Missing platforms",
        description: "Please select at least one platform",
        variant: "destructive",
      });
      return;
    }

    if (finalAssets.length === 0) {
      toast({
        title: "Missing content",
        description: "Please upload final content first",
        variant: "destructive",
      });
      return;
    }

    try {
      const [hours, minutes] = scheduledTime.split(":");
      const scheduleDateTime = new Date(scheduledDate);
      scheduleDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const utcDateTime = convertToUTC(scheduleDateTime, userTimezone);

      const supportedPlatforms = selectedPlatforms.filter((p) => p === "instagram" || p === "facebook");

      if (supportedPlatforms.length === 0) {
        toast({
          title: "No supported platforms",
          description: "Currently only Instagram and Facebook are supported for scheduling",
          variant: "destructive",
        });
        return;
      }

      const { data: projectRow, error: projectError } = await supabase
        .from("projects")
        .select("agency_id")
        .eq("id", project.id)
        .single();

      if (projectError) throw projectError;

      const agencyId = projectRow?.agency_id as string | undefined;

      const { data: connectionsData, error: connectionsError } = await supabase
        .from("social_connections")
        .select("id, platform, status")
        .eq("client_id", project.client_id)
        .eq("status", "connected");

      if (connectionsError) throw connectionsError;

      const connectionMap: Record<string, string | null> = {};
      supportedPlatforms.forEach((platform) => {
        const match = connectionsData?.find((c) => c.platform === platform && c.status === "connected");
        connectionMap[platform] = match ? match.id : null;
      });

      const insertPromises = supportedPlatforms.map((platform) =>
        supabase.from("scheduled_posts").insert({
          project_id: project.id,
          agency_id: agencyId,
          client_id: project.client_id,
          platform,
          social_connection_id: connectionMap[platform],
          scheduled_for: utcDateTime,
          status: "pending",
          caption: captions[platform] || null,
        }),
      );

      const insertResults = await Promise.all(insertPromises);
      const insertError = insertResults.find((r) => r.error)?.error;
      if (insertError) throw insertError;

      const { error } = await supabase
        .from("projects")
        .update({
          scheduled_time: utcDateTime,
          platforms: supportedPlatforms,
          platform_captions: captions,
          hashtags: hashtags || null,
          pipeline_stage: "scheduled",
        })
        .eq("id", project.id);

      if (error) throw error;

      toast({
        title: "Scheduled",
        description: `Post scheduled successfully for ${format(scheduleDateTime, "PPP 'at' p")} (${userTimezone})`,
      });

      onUpdate();
    } catch (error) {
      console.error("Error scheduling post:", error);
      toast({
        title: "Error",
        description: "Failed to schedule post",
        variant: "destructive",
      });
    }
  };

  const handleSaveSettings = async () => {
    try {
      const supportedPlatforms = selectedPlatforms.filter((p) => p === "instagram" || p === "facebook");

      const updateData: any = {
        platforms: supportedPlatforms,
        platform_captions: captions,
        hashtags: hashtags || null,
      };

      if (scheduledDate && scheduledTime) {
        const [hours, minutes] = scheduledTime.split(":");
        const scheduleDateTime = new Date(scheduledDate);
        scheduleDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        updateData.scheduled_time = convertToUTC(scheduleDateTime, userTimezone);
      }

      const { error } = await supabase.from("projects").update(updateData).eq("id", project.id);

      if (error) throw error;

      toast({
        title: "Saved",
        description: "Final content settings updated successfully",
      });

      onUpdate();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    }
  };

  const aiActions = [
    {
      id: "ideas",
      label: "Generate Ideas",
      icon: Lightbulb,
      description: "Get content ideas based on niche and trends",
      color: "text-yellow-500",
    },
    {
      id: "hooks",
      label: "Generate Hooks",
      icon: PenTool,
      description: "Create attention-grabbing opening hooks",
      color: "text-primary",
    },
    {
      id: "script",
      label: "Write Script",
      icon: FileText,
      description: "Generate complete video scripts",
      color: "text-blue-500",
    },
    {
      id: "improve-script",
      label: "Improve Script",
      icon: RefreshCw,
      description: "Enhance existing script content",
      color: "text-green-500",
    },
    {
      id: "captions",
      label: "Generate Captions",
      icon: MessageSquare,
      description: "Create platform-specific captions",
      color: "text-pink-500",
    },
    {
      id: "improve-caption",
      label: "Improve Captions",
      icon: RefreshCw,
      description: "Enhance existing caption text",
      color: "text-orange-500",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading final content...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Error Message Display */}
      {project.error_message && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-destructive mb-1">Publishing Failed</h4>
                <p className="text-sm text-destructive/90">{project.error_message}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Assistant Button */}
      <div className="flex justify-end">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Sparkles className="h-4 w-4" />
              AI Assist
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-96 overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Content Assistant
              </SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-3">
              {aiActions.map((action) => (
                <Button
                  key={action.id}
                  variant="outline"
                  className="w-full justify-start h-auto py-4 px-4 hover:bg-accent"
                  onClick={() => setActiveAIModal(action.id)}
                >
                  <div className="flex items-start gap-3 text-left w-full">
                    <action.icon className={`h-5 w-5 mt-0.5 ${action.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{action.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{action.description}</div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Upload Final Content */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Final Content</h3>
          <label htmlFor="final-content-upload">
            <Button disabled={uploading} asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Uploading..." : "Upload Final Content"}
              </span>
            </Button>
          </label>
          <input
            id="final-content-upload"
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {finalAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 border-2 border-dashed rounded-lg">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Final Content</h3>
            <p className="text-muted-foreground text-center mb-4">
              Upload the final content that clients will see for review
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {finalAssets.map((asset) => (
              <Card key={asset.id} className="relative group overflow-hidden">
                <div className="aspect-square bg-muted flex items-center justify-center">
                  {asset.file_type === "image" ? (
                    <img src={asset.file_url} alt={asset.filename} className="w-full h-full object-cover" />
                  ) : asset.file_type === "video" ? (
                    <video src={asset.file_url} className="w-full h-full object-cover" />
                  ) : (
                    <p className="text-sm text-muted-foreground">{asset.filename}</p>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveFinalAsset(asset.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="p-2 bg-background">
                  <p className="text-xs truncate">{asset.filename}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Platform Selection */}
      <div>
        <Label className="text-base font-semibold mb-3 block">Publishing Platforms</Label>
        <div className="grid grid-cols-2 gap-3">
          {PLATFORMS.map((platform) => (
            <div key={platform.id} className="flex items-center space-x-2 opacity-100">
              <Checkbox
                id={platform.id}
                checked={selectedPlatforms.includes(platform.id)}
                onCheckedChange={() => handlePlatformToggle(platform.id)}
                disabled={!platform.enabled}
              />
              <label
                htmlFor={platform.id}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
              >
                {platform.label}
                {!platform.enabled && (
                  <Badge variant="secondary" className="text-xs">
                    Coming Soon
                  </Badge>
                )}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Platform-Specific Captions with AI Integration */}
      {selectedPlatforms.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Platform Captions</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleGenerateCaption()}
              disabled={generatingAI["all"] || selectedPlatforms.length === 0}
            >
              {generatingAI["all"] ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Generate All Captions
            </Button>
          </div>

          {selectedPlatforms.map((platformId) => {
            const platform = PLATFORMS.find((p) => p.id === platformId);
            const charLimit = getCharacterLimit(platformId);
            const currentCaption = captions[platformId] || "";
            const isOverLimit = charLimit && currentCaption.length > charLimit;

            return (
              <div key={platformId} className="space-y-2 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`caption-${platformId}`} className="flex items-center gap-2">
                    {platform?.label}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleGenerateCaption(platformId)}
                      disabled={generatingAI[platformId]}
                      className="h-6 px-2"
                    >
                      {generatingAI[platformId] ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Wand2 className="h-3 w-3" />
                      )}
                    </Button>
                  </Label>
                  {charLimit && (
                    <span className={`text-xs ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
                      {currentCaption.length} / {charLimit} characters
                    </span>
                  )}
                </div>
                <Textarea
                  id={`caption-${platformId}`}
                  placeholder={`Write caption for ${platform?.label}...`}
                  value={currentCaption}
                  onChange={(e) =>
                    setCaptions((prev) => ({
                      ...prev,
                      [platformId]: e.target.value,
                    }))
                  }
                  rows={4}
                  className={isOverLimit ? "border-destructive" : ""}
                />
                {isOverLimit && (
                  <Badge variant="destructive" className="mt-1">
                    Over limit by {currentCaption.length - charLimit} characters
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* AI Variants Selection */}
      {showVariants && aiVariants.length > 0 && (
        <div className="space-y-2 p-4 rounded-lg border border-border bg-accent/20">
          <Label>AI-Generated Variants</Label>
          <p className="text-sm text-muted-foreground mb-2">Select a variant to apply:</p>
          {aiVariants.map((variant, index) => (
            <div
              key={index}
              className="p-3 rounded border border-border bg-background hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => applyAIVariant(variant)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {variant.platform && (
                    <Badge variant="outline" className="capitalize">
                      {variant.platform}
                    </Badge>
                  )}
                  <Badge variant="secondary">{variant.length}</Badge>
                </div>
                <Button size="sm" variant="ghost">
                  Apply
                </Button>
              </div>
              <p className="text-sm">{variant.caption}</p>
            </div>
          ))}
        </div>
      )}

      {/* Hashtags */}
      <div className="space-y-2">
        <Label htmlFor="hashtags">Hashtags</Label>
        <Textarea
          id="hashtags"
          placeholder="#contentmarketing #socialmedia #brand"
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          rows={2}
        />
      </div>

      {/* Schedule Post Section */}
      <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Schedule Post</h3>
              <Badge variant="secondary" className="gap-1">
                <Globe className="h-3 w-3" />
                {userTimezone}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => window.open("/scheduling-debug", "_blank")}>
              <ExternalLink className="h-3 w-3 mr-1" />
              Debug
            </Button>
          </div>
          <div className="p-3 bg-primary/10 rounded-lg text-sm space-y-1">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="font-medium">How scheduling works:</p>
                <ul className="text-xs space-y-0.5 text-muted-foreground">
                  <li>
                    • Pick a time in <span className="font-medium text-foreground">{userTimezone}</span>
                  </li>
                  <li>• System stores it in UTC for autoposting</li>
                  <li>• Displays always show your local timezone</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input id="time" type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            {scheduledDate && scheduledTime && (
              <p className="text-xs text-muted-foreground mt-1">
                Will be saved as:{" "}
                {format(
                  convertToUTC(
                    new Date(
                      scheduledDate.getFullYear(),
                      scheduledDate.getMonth(),
                      scheduledDate.getDate(),
                      parseInt(scheduledTime.split(":")[0]),
                      parseInt(scheduledTime.split(":")[1]),
                    ),
                    userTimezone,
                  ),
                  "HH:mm",
                )}{" "}
                UTC (server time)
              </p>
            )}
          </div>
        </div>

        {/* Optimal Posting Times */}
        {selectedPlatforms.length > 0 && scheduledDate && (
          <Card className="p-4 bg-blue-500/10 border-blue-500/20">
            <div className="flex items-start gap-2 mb-3">
              <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm mb-2">Optimal Posting Times</h4>
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-3">
                    {getAllPlatformSuggestions(selectedPlatforms, scheduledDate).map(
                      ({ platform, suggestedTime, rules }) => (
                        <div key={platform} className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="capitalize">
                              {platform}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Best time: {format(suggestedTime, "h:mm a")}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs"
                              onClick={() => setScheduledTime(format(suggestedTime, "HH:mm"))}
                            >
                              Use this time
                            </Button>
                          </div>
                          {rules && rules.bestPractices.length > 0 && (
                            <ul className="text-xs text-muted-foreground ml-2 space-y-0.5">
                              {rules.bestPractices.slice(0, 2).map((practice, idx) => (
                                <li key={idx}>• {practice}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </Card>
        )}

        <Button
          onClick={handleSchedulePost}
          className="w-full"
          disabled={!scheduledDate || selectedPlatforms.length === 0 || finalAssets.length === 0 || uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Scheduling...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Schedule Post
            </>
          )}
        </Button>

        {project.status === "published" && project.published_urls && (
          <div className="space-y-2 mt-4 p-3 rounded bg-green-500/10 border border-green-500/20">
            <p className="text-sm font-medium text-green-600">✓ Published successfully</p>
            <div className="space-y-1">
              {Object.entries(project.published_urls as Record<string, string>).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline block"
                >
                  View on {platform.charAt(0).toUpperCase() + platform.slice(1)} →
                </a>
              ))}
            </div>
          </div>
        )}

        {project.status === "scheduled" && project.scheduled_time && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Scheduled for:</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold">
                  {format(convertToLocal(project.scheduled_time, userTimezone), "MMMM d, yyyy")} at{" "}
                  {format(convertToLocal(project.scheduled_time, userTimezone), "h:mm a")}
                </p>
                <Badge variant="secondary" className="gap-1">
                  <Globe className="h-3 w-3" />
                  {userTimezone}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                UTC: {new Date(project.scheduled_time).toISOString().replace("T", " ").slice(0, 19)} (server time)
              </p>
            </div>
          </div>
        )}

        {project.status === "failed" && project.error_message && (
          <p className="text-sm text-red-600 mt-4">✕ Publishing failed: {project.error_message}</p>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleSaveSettings}>Save Settings</Button>
      </div>

      {/* AI Generation Modals */}
      <AIGenerateModal
        open={activeAIModal === "ideas"}
        onOpenChange={(open) => !open && setActiveAIModal(null)}
        type="ideas"
        clientId={project.client_id}
        projectId={project.id}
        onUse={(result) => handleAIGenerateComplete("ideas", result)}
      />
      <AIGenerateModal
        open={activeAIModal === "hooks"}
        onOpenChange={(open) => !open && setActiveAIModal(null)}
        type="hooks"
        clientId={project.client_id}
        projectId={project.id}
        onUse={(result) => handleAIGenerateComplete("hooks", result)}
      />
      <AIGenerateModal
        open={activeAIModal === "script"}
        onOpenChange={(open) => !open && setActiveAIModal(null)}
        type="script"
        clientId={project.client_id}
        projectId={project.id}
        onUse={(result) => handleAIGenerateComplete("script", result)}
      />
      <AIGenerateModal
        open={activeAIModal === "improve-script"}
        onOpenChange={(open) => !open && setActiveAIModal(null)}
        type="improve-script"
        clientId={project.client_id}
        projectId={project.id}
        onUse={(result) => handleAIGenerateComplete("improve-script", result)}
      />
      <AIGenerateModal
        open={activeAIModal === "captions"}
        onOpenChange={(open) => !open && setActiveAIModal(null)}
        type="captions"
        clientId={project.client_id}
        projectId={project.id}
        onUse={(result) => handleAIGenerateComplete("captions", result)}
      />
      <AIGenerateModal
        open={activeAIModal === "improve-caption"}
        onOpenChange={(open) => !open && setActiveAIModal(null)}
        type="improve-caption"
        clientId={project.client_id}
        projectId={project.id}
        onUse={(result) => handleAIGenerateComplete("improve-caption", result)}
      />
    </div>
  );
}
