import { motion } from "framer-motion";
import { Palette, Image, Lightbulb, CheckCircle2 } from "lucide-react";

export default function ClientCommandMockup() {
  return (
    <motion.div 
      className="rounded-xl border-2 border-border bg-surface shadow-xl overflow-hidden"
    >
      <div className="p-6 space-y-6">
        {/* Branding Colors Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Brand Colors</h4>
          </div>
          <div className="flex gap-2">
            <div className="w-12 h-12 rounded-lg bg-primary border-2 border-border shadow-sm" />
            <div className="w-12 h-12 rounded-lg bg-accent border-2 border-border shadow-sm" />
            <div className="w-12 h-12 rounded-lg bg-[#F59E0B] border-2 border-border shadow-sm" />
            <div className="w-12 h-12 rounded-lg bg-[#8B5CF6] border-2 border-border shadow-sm" />
            <div className="w-12 h-12 rounded-lg bg-card border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-xs">
              +
            </div>
          </div>
        </div>

        {/* Ideas Board Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Content Ideas</h4>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card border border-border rounded-lg p-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Ideas</div>
              <div className="space-y-2">
                <div className="bg-background border border-border rounded p-2">
                  <div className="h-2 bg-muted rounded w-3/4 mb-1" />
                  <div className="h-1.5 bg-muted rounded w-1/2" />
                </div>
                <div className="bg-background border border-border rounded p-2">
                  <div className="h-2 bg-muted rounded w-2/3 mb-1" />
                  <div className="h-1.5 bg-muted rounded w-3/4" />
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Approved</div>
              <div className="space-y-2">
                <div className="bg-background border border-success/50 rounded p-2">
                  <div className="h-2 bg-muted rounded w-2/3 mb-1" />
                  <div className="h-1.5 bg-muted rounded w-1/2" />
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">In Progress</div>
              <div className="space-y-2">
                <div className="bg-background border border-primary/50 rounded p-2">
                  <div className="h-2 bg-muted rounded w-3/4 mb-1" />
                  <div className="h-1.5 bg-muted rounded w-2/3" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Assets Grid Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Image className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Asset Library</h4>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="aspect-square rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 border border-border hover:border-primary/50 transition-colors cursor-pointer"
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
