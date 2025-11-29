import { useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import {
  FileVideo,
  FileImage,
  FileAudio,
  File,
  User,
  Calendar,
  Tag,
  MoreVertical,
  GripVertical,
  Send,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

interface AssetPipelineCardProps {
  asset: {
    id: string;
    title: string | null;
    filename: string;
    file_url: string;
    file_type: string;
    content_type: string | null;
    custom_category: string | null;
    uploaded_by: string | null;
    created_at: string;
    pipeline_stage: string;
  };
  index: number;
  uploaderEmail?: string;
  onMoveStage?: (assetId: string, newStage: string) => void;
  onView?: (assetId: string) => void;
}

export default function AssetPipelineCard({
  asset,
  index,
  uploaderEmail,
  onMoveStage,
  onView,
}: AssetPipelineCardProps) {
  const [imageError, setImageError] = useState(false);

  const getFileIcon = () => {
    switch (asset.file_type) {
      case "video":
        return <FileVideo className="h-8 w-8 text-primary" />;
      case "image":
        return <FileImage className="h-8 w-8 text-primary" />;
      case "audio":
        return <FileAudio className="h-8 w-8 text-primary" />;
      default:
        return <File className="h-8 w-8 text-primary" />;
    }
  };

  const getStageActions = () => {
    switch (asset.pipeline_stage) {
      case "idea":
        return [{ label: "Move to In Production", stage: "in_production" as const }];
      case "in_production":
        return [
          { label: "Send for Client Review", stage: "review" as const },
          { label: "Move back to Idea", stage: "idea" as const },
        ];
      case "review":
        return [{ label: "Move back to In Production", stage: "in_production" as const }];
      case "approved":
        return [
          { label: "Schedule", stage: "scheduled" as const },
          { label: "Move back to Review", stage: "review" as const },
        ];
      case "scheduled":
        return [
          { label: "Move back to Approved", stage: "approved" as const },
          { label: "Mark as Published", stage: "published" as const },
        ];
      case "published":
        return [];
      default:
        return [];
    }
  };

  const getThumbnail = () => {
    if (asset.file_type === "image" && !imageError) {
      return (
        <img
          src={asset.file_url}
          alt={asset.filename}
          className="w-full h-32 object-cover rounded-t-lg"
          onError={() => setImageError(true)}
        />
      );
    }

    if (asset.file_type === "video") {
      return (
        <div className="w-full h-32 bg-muted rounded-t-lg flex items-center justify-center">
          <video src={asset.file_url} className="w-full h-full object-cover rounded-t-lg" muted />
        </div>
      );
    }

    return <div className="w-full h-32 bg-muted rounded-t-lg flex items-center justify-center">{getFileIcon()}</div>;
  };

  return (
    <Draggable draggableId={asset.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`overflow-hidden transition-all duration-200 group ${
            snapshot.isDragging ? "shadow-2xl ring-2 ring-primary scale-75 transform-gpu" : "hover:shadow-md"
          }`}
          style={{
            ...provided.draggableProps.style,
            // Add transform to ensure smooth scaling
            transform: snapshot.isDragging
              ? `${provided.draggableProps.style?.transform || ""} scale(0.75)`
              : provided.draggableProps.style?.transform,
          }}
        >
          <div
            {...provided.dragHandleProps}
            className="absolute top-2 left-2 z-10 opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          >
            <div className="bg-background/90 backdrop-blur-sm rounded p-1.5 shadow-sm">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div onClick={() => onView?.(asset.id)} className="cursor-pointer">
            {getThumbnail()}
          </div>

          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium line-clamp-2 text-sm">{asset.title || asset.filename}</h4>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onView?.(asset.id)}>View Details</DropdownMenuItem>
                  {getStageActions().map((action) => (
                    <DropdownMenuItem key={action.stage} onClick={() => onMoveStage?.(asset.id, action.stage)}>
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {asset.pipeline_stage === "in_production" && (
              <Button onClick={() => onMoveStage?.(asset.id, "review")} className="w-full" size="sm">
                <Send className="h-4 w-4 mr-2" />
                Send for Client Review
              </Button>
            )}

            {asset.content_type && (
              <Badge variant="secondary" className="text-xs">
                <Tag className="h-3 w-3 mr-1" />
                {asset.content_type
                  .split("_")
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" ")}
              </Badge>
            )}

            {asset.custom_category && (
              <p className="text-xs text-muted-foreground line-clamp-2">{asset.custom_category}</p>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
              {uploaderEmail && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span className="truncate">{uploaderEmail}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{format(new Date(asset.created_at), "MMM d")}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </Draggable>
  );
}
