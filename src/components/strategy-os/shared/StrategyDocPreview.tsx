import { useEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ActiveView } from "@/lib/strategy/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { FileText, Upload, PencilLine, Sparkles, ArrowUpRight } from "lucide-react";

type StrategyDocKey = ActiveView;

interface StrategyDocDefinition {
  title: string;
  summary: string;
  content: string;
  updatedLabel: string;
  status: "Draft" | "Ready";
}

const STRATEGY_DOCS: Record<StrategyDocKey, StrategyDocDefinition> = {
  "mission-control": {
    title: "Strategy Overview Brief",
    summary: "High-level goals, priorities, and module alignment for the current strategy plan.",
    content:
      "This strategy brief summarizes the client goals, brand guardrails, and near-term priorities. It anchors the full plan across positioning, pillars, campaign direction, weekly execution, channel adaptations, and compliance rules.\n\nKey focus this cycle:\n- Align messaging to the primary ICP segment\n- Lock proof points and differentiators before campaign rollout\n- Prioritize the top two pillars for first 30 days\n\nUse this brief to keep the team aligned before diving into each module.",
    updatedLabel: "Updated today",
    status: "Draft",
  },
  positioning: {
    title: "Positioning Document",
    summary: "Core positioning sentence, differentiators, and proof points.",
    content:
      "This document captures the positioning sentence and supporting proof points that define why the client wins. It should be concise, precise, and approved before content production.\n\nInclude:\n- Target audience and category framing\n- Primary differentiator and evidence\n- Approved wording and banned phrasing\n\nKeep this doc as the source of truth for all messaging.",
    updatedLabel: "Updated 2 days ago",
    status: "Draft",
  },
  pillars: {
    title: "Content Pillars Document",
    summary: "Pillar themes, coverage split, and angle constraints.",
    content:
      "This document outlines the content pillars, their coverage percentages, and the approved messaging angles. It is the content backbone for the calendar and production tasks.\n\nInclude:\n- Pillar names with purpose and KPI focus\n- Coverage split and supporting proof inventory\n- Banned angles or off-limit topics\n\nReview with the client to confirm the thematic focus.",
    updatedLabel: "Updated 5 days ago",
    status: "Draft",
  },
  campaign_plan: {
    title: "Campaign Plan Document",
    summary: "Monthly campaign structure, offers, CTAs, and asset needs.",
    content:
      "This plan defines monthly campaign priorities with offers, CTAs, and launch windows. It drives the production cadence and reporting view.\n\nInclude:\n- Campaign goals and offer details\n- CTA language with guardrails\n- Asset checklist and timelines\n\nLock this doc before scheduling production tasks.",
    updatedLabel: "Updated 1 week ago",
    status: "Draft",
  },
  weekly_plan: {
    title: "Weekly Plan Document",
    summary: "Weekly objective, cadence matrix, and production checklist.",
    content:
      "This weekly plan turns the campaign strategy into execution. It sets the weekly objective, channel cadence, and production checklist for the team.\n\nInclude:\n- Weekly objective and priority pillar focus\n- Post cadence per channel\n- Production checklist with owners and deadlines\n\nUse this doc to align the team each Monday.",
    updatedLabel: "Updated 3 days ago",
    status: "Draft",
  },
  channel_adaptations: {
    title: "Channel Adaptations Document",
    summary: "Platform-specific tone, format rules, and CTA variations.",
    content:
      "This document translates the core strategy into channel-specific guidance. It defines tone, format, and CTA rules for each platform.\n\nInclude:\n- Format rules and hook patterns\n- CTA variations per platform\n- Visual do/dont guidelines\n\nReference this doc during production and review.",
    updatedLabel: "Updated 4 days ago",
    status: "Draft",
  },
  rules_constraints: {
    title: "Rules & Constraints Document",
    summary: "Compliance rules, claims policy, and approval triggers.",
    content:
      "This document captures the non-negotiables: claims policy, banned terms, and approval triggers. It protects the client and agency from risky content.\n\nInclude:\n- Allowed vs forbidden claims\n- Required disclaimers and citations\n- Approval triggers and escalation rules\n\nReview with stakeholders before any publishing.",
    updatedLabel: "Updated yesterday",
    status: "Draft",
  },
};

function getDocDefinition(view: StrategyDocKey) {
  return STRATEGY_DOCS[view] ?? STRATEGY_DOCS["mission-control"];
}

interface StrategyDocPreviewProps {
  view: StrategyDocKey;
}

export function StrategyDocPreview({ view }: StrategyDocPreviewProps) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const doc = useMemo(() => getDocDefinition(view), [view]);

  useEffect(() => {
    setDraft(doc.content);
    setIsEditing(false);
    setUploadedName(null);
  }, [doc.content]);

  const previewText = doc.content.replace(/\s+/g, " ").slice(0, 160);

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedName(file.name);
    }
  };

  const contentBody = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{doc.status}</Badge>
        <Badge variant="outline">Strategy Doc</Badge>
        <span className="text-xs text-muted-foreground">{doc.updatedLabel}</span>
      </div>
      <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
        {doc.summary}
      </div>
      {isEditing ? (
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="min-h-[260px]"
        />
      ) : (
        <div className="rounded-lg border bg-background p-4 text-sm whitespace-pre-wrap">
          {draft}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {uploadedName ? (
          <span>Last upload: {uploadedName}</span>
        ) : (
          <span>No uploads yet</span>
        )}
      </div>
    </div>
  );

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={isEditing ? "default" : "outline"}
        size="sm"
        onClick={() => setIsEditing((value) => !value)}
      >
        <PencilLine className="mr-2 h-4 w-4" />
        {isEditing ? "Finish editing" : "Edit document"}
      </Button>
      <Button variant="outline" size="sm" onClick={handleUpload}>
        <Upload className="mr-2 h-4 w-4" />
        Upload file
      </Button>
      <Button variant="outline" size="sm">
        <Sparkles className="mr-2 h-4 w-4" />
        AI draft
      </Button>
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
    </div>
  );

  return (
    <>
      <button type="button" className="w-full text-left" onClick={() => setOpen(true)}>
        <Card className="border border-border/60 bg-gradient-to-r from-muted/40 via-background to-background shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{doc.title}</h3>
                    <p className="text-xs text-muted-foreground">{doc.updatedLabel}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{previewText}...</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant="secondary">{doc.status}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpen(true);
                  }}
                >
                  Open doc
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </button>

      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader>
              <DrawerTitle>{doc.title}</DrawerTitle>
              <DrawerDescription>{doc.summary}</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-6 space-y-4">
              {actions}
              {contentBody}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{doc.title}</DialogTitle>
              <DialogDescription>{doc.summary}</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {actions}
              {contentBody}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
