import { motion } from "framer-motion";
import { LayoutGrid, Users, Calendar, FolderOpen, Settings, Plus } from "lucide-react";

export default function HeroMockup() {
  return (
    <motion.div 
      className="relative"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.3 }}
      whileHover={{ y: -4 }}
    >
      {/* Desktop Window Frame */}
      <div className="rounded-xl border-2 border-border bg-surface shadow-2xl overflow-hidden">
        {/* Window Controls */}
        <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-xs text-muted-foreground font-medium">SMMAHUB Dashboard</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex h-[400px] sm:h-[500px]">
          {/* Sidebar */}
          <div className="w-16 bg-card border-r border-border flex flex-col items-center py-6 gap-4">
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

          {/* Main Dashboard Area */}
          <div className="flex-1 bg-background p-6 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Dashboard</h3>
                <p className="text-xs text-muted-foreground">Welcome back!</p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                <Plus className="w-4 h-4" />
                New Client
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <motion.div 
                className="bg-card border border-border rounded-lg p-4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Total Clients</span>
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div className="text-2xl font-bold text-foreground">24</div>
                <div className="text-xs text-success mt-1">+12% this month</div>
              </motion.div>

              <motion.div 
                className="bg-card border border-border rounded-lg p-4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Posts Scheduled</span>
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <div className="text-2xl font-bold text-foreground">156</div>
                <div className="text-xs text-success mt-1">+8% this week</div>
              </motion.div>

              <motion.div 
                className="bg-card border border-border rounded-lg p-4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Active Tasks</span>
                  <FolderOpen className="w-4 h-4 text-primary" />
                </div>
                <div className="text-2xl font-bold text-foreground">42</div>
                <div className="text-xs text-warning mt-1">12 due today</div>
              </motion.div>
            </div>

            {/* Content Area - Client Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">Recent Clients</h4>
                <span className="text-xs text-muted-foreground">View all →</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="bg-card border border-border rounded-lg p-3 hover:border-primary/50 transition-colors cursor-pointer"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + i * 0.1 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          Client {i}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {i * 3} posts this week
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating gradient effect */}
      <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl blur-3xl opacity-30 -z-10" />
    </motion.div>
  );
}
