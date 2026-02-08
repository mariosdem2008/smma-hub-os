import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import type { OnboardingChatMessage } from "./types";

type MessageStreamProps = {
  messages: OnboardingChatMessage[];
  className?: string;
  compactCount?: number;
};

export function MessageStream({ messages, className, compactCount }: MessageStreamProps) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border bg-card/40 p-6 text-center">
        <div className="max-w-sm space-y-2">
          <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            AI-guided onboarding
          </div>
          <div className="text-lg font-semibold">Share a few details to get started.</div>
          <p className="text-sm text-muted-foreground">
            The assistant will ask a handful of focused questions. You can answer in sentences, bullet points, or
            paste notes.
          </p>
        </div>
      </div>
    );
  }

  const display = typeof compactCount === "number" ? messages.slice(-compactCount) : messages;

  return (
    <div className="space-y-3">
      {typeof compactCount === "number" && messages.length > compactCount && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing latest {compactCount} messages</span>
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="ghost" size="sm">View history</Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[80vh]">
              <DrawerHeader>
                <DrawerTitle>Onboarding history</DrawerTitle>
                <DrawerDescription>Full conversation log</DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-6">
                <ScrollArea className="h-[60vh] rounded-md border bg-background p-4">
                  <div className="flex flex-col gap-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex w-full ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
                      >
                        <Card
                          className={`max-w-[85%] p-4 ${
                            message.role === "assistant"
                              ? "border-primary/30 bg-card/80"
                              : "border-border bg-muted/40"
                          }`}
                        >
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {message.role === "assistant" ? "Assistant" : "You"}
                          </div>
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                          </div>
                          {message.json && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                                JSON snapshot
                              </summary>
                              <pre className="mt-2 overflow-x-auto rounded-md bg-muted/60 p-3 text-xs">
                                {JSON.stringify(message.json, null, 2)}
                              </pre>
                            </details>
                          )}
                        </Card>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      )}
      <ScrollArea className={className ?? "h-[58vh] w-full rounded-md border bg-background p-4"}>
        <div className="flex flex-col gap-4">
          {display.map((message) => (
            <div
              key={message.id}
              className={`flex w-full ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
            >
              <Card
                className={`max-w-[85%] p-4 ${
                  message.role === "assistant"
                    ? "border-primary/30 bg-card/80"
                    : "border-border bg-muted/40"
                }`}
              >
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {message.role === "assistant" ? "Assistant" : "You"}
                </div>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                </div>
                {message.json && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                      JSON snapshot
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded-md bg-muted/60 p-3 text-xs">
                      {JSON.stringify(message.json, null, 2)}
                    </pre>
                  </details>
                )}
              </Card>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
