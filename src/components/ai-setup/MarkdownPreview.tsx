import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function isExternalHref(href: string) {
  return href.startsWith("http://") || href.startsWith("https://");
}

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mt-0 border-b border-border/60 pb-2 text-2xl">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-6 text-xl text-primary">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-5 text-lg">{children}</h3>,
          p: ({ children }) => <p className="text-sm leading-6 text-slate-200">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-slate-50">{children}</strong>,
          a: ({ href, children }) => {
            const safeHref = typeof href === "string" ? href : "#";
            return (
              <a
                href={safeHref}
                className="text-primary underline underline-offset-4 hover:text-primary/90"
                target={isExternalHref(safeHref) ? "_blank" : undefined}
                rel={isExternalHref(safeHref) ? "noreferrer" : undefined}
              >
                {children}
              </a>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="rounded-r-lg border-l-4 border-primary/50 bg-card/40 px-4 py-2 text-slate-200">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-slate-100" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={`block overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs ${className}`} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="overflow-x-auto rounded-lg bg-muted p-3">{children}</pre>,
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-border/60">
              <table className="min-w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/40">{children}</thead>,
          th: ({ children }) => <th className="border-b border-border/60 px-3 py-2 text-left font-medium">{children}</th>,
          td: ({ children }) => <td className="border-b border-border/30 px-3 py-2 align-top">{children}</td>,
          hr: () => <hr className="my-6 border-border/60" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

