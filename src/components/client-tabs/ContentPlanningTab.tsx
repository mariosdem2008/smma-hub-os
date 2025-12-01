import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import IdeasBoard from "./IdeasTab";
import ScriptsTab from "../scripts/ScriptsTab";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useClientAIHistory } from "@/hooks/useClientAIHistory";

interface ContentPlanningTabProps {
  clientId: string;
}

export default function ContentPlanningTab({ clientId }: ContentPlanningTabProps) {
  const { data, loading, error } = useClientAIHistory(clientId);

  const renderSuggestionPreview = (rowMode: string, row: any) => {
    const output: any = row.output || {};
    const suggestions = output.suggestions || [];
    const first = suggestions[0] || {};

    if (rowMode === "ideas") {
      return first.title || first.description || "Idea generated";
    }

    return first.text || "Generated content";
  };

  const renderHistoryList = (rows: any[] | undefined) => {
    if (loading) {
      return <p className="text-sm text-muted-foreground">Loading AI history...</p>;
    }

    if (error) {
      return <p className="text-sm text-destructive">{error}</p>;
    }

    if (!rows || rows.length === 0) {
      return <p className="text-sm text-muted-foreground">No AI generations yet for this client.</p>;
    }

    return (
      <div className="space-y-3">
        {rows.map((row) => (
          <Card key={row.id} className="border-border/60 bg-card/60">
            <CardContent className="py-3 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="uppercase text-[10px] tracking-wide">
                    {row.mode}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <p className="text-sm text-foreground line-clamp-2">
                {renderSuggestionPreview(row.mode, row)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full">
      <Tabs defaultValue="ideas" className="w-full">
        <TabsList className="mb-6 flex flex-wrap gap-2">
          <TabsTrigger value="ideas">Ideas</TabsTrigger>
          <TabsTrigger value="scripts">Scripts</TabsTrigger>
          <TabsTrigger value="ai-ideas">AI Ideas</TabsTrigger>
          <TabsTrigger value="ai-hooks">AI Hooks</TabsTrigger>
          <TabsTrigger value="ai-captions">AI Captions</TabsTrigger>
          <TabsTrigger value="ai-scripts">AI Scripts</TabsTrigger>
          <TabsTrigger value="ai-all">All AI Content</TabsTrigger>
        </TabsList>

        <TabsContent value="ideas">
          <IdeasBoard clientId={clientId} />
        </TabsContent>

        <TabsContent value="scripts">
          <ScriptsTab clientId={clientId} />
        </TabsContent>

        <TabsContent value="ai-ideas">
          {renderHistoryList(data?.ideas)}
        </TabsContent>

        <TabsContent value="ai-hooks">
          {renderHistoryList(data?.hooks)}
        </TabsContent>

        <TabsContent value="ai-captions">
          {renderHistoryList(data?.captions)}
        </TabsContent>

        <TabsContent value="ai-scripts">
          {renderHistoryList(data?.scripts)}
        </TabsContent>

        <TabsContent value="ai-all">
          {renderHistoryList(data?.all)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
