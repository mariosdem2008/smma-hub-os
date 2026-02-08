import { motion } from "framer-motion";
import { Calendar, FolderOpen, LayoutGrid, Plus, Settings, Users } from "lucide-react";

export default function HeroMockup() {
  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.3 }}
      whileHover={{ y: -2 }}
    >
      <div className="mockup-window rounded-xl overflow-hidden">
        <div className="mockup-window-header flex items-center gap-2 px-4 py-3">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-xs text-muted-foreground font-medium">SMMAHUB Dashboard (Sample UI)</span>
          </div>
        </div>

        <div className="flex h-[400px] sm:h-[500px]">
          <div className="mockup-window-sidebar w-16 flex flex-col items-center py-6 gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-primary" />
            </div>
            <div className="w-10 h-10 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="w-10 h-10 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
              <Calendar className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="w-10 h-10 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
              <FolderOpen className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="mt-auto w-10 h-10 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
              <Settings className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>

          <div className="mockup-window-body flex-1 p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Dashboard</h3>
                <p className="text-xs text-muted-foreground">Welcome back</p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/90 text-white rounded-lg text-sm font-medium">
                <Plus className="w-4 h-4" />
                New client
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <StatCard title="Total clients" icon={Users} delay={0.5} />
              <StatCard title="Posts scheduled" icon={Calendar} delay={0.6} />
              <StatCard title="Active tasks" icon={FolderOpen} delay={0.7} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">Recent clients</h4>
                <span className="text-xs text-muted-foreground">View all →</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="bg-card border border-border rounded-lg p-3 hover:border-primary/40 transition-colors cursor-pointer"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + i * 0.1 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">Client {i}</div>
                        <div className="text-xs text-muted-foreground">Sample tasks</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -inset-6 bg-gradient-to-r from-primary/18 to-accent/14 rounded-xl blur-3xl opacity-25 -z-10" />
    </motion.div>
  );
}

function StatCard(props: { title: string; icon: typeof Users; delay: number }) {
  const Icon = props.icon;
  return (
    <motion.div
      className="bg-card border border-border rounded-lg p-4"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: props.delay }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{props.title}</span>
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="text-2xl font-bold text-foreground">—</div>
      <div className="text-xs text-muted-foreground mt-1">Sample data</div>
    </motion.div>
  );
}

