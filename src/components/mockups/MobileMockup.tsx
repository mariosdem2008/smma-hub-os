import { motion } from "framer-motion";
import { Users, Calendar, CheckCircle2, Clock } from "lucide-react";

export default function MobileMockup() {
  return (
    <motion.div 
      className="mx-auto w-[280px]"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.05, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* iPhone Frame */}
      <div className="relative">
        {/* Phone Border */}
        <div className="relative bg-gradient-to-b from-gray-800 to-gray-900 rounded-[2.5rem] p-3 shadow-2xl border-4 border-gray-800">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-6 bg-gray-900 rounded-b-2xl z-10" />
          
          {/* Screen */}
          <div className="relative bg-background rounded-[2rem] overflow-hidden">
            {/* Status Bar */}
            <div className="bg-surface px-6 py-3 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">9:41</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-3 border border-foreground rounded-sm" />
                <div className="w-1 h-2 bg-foreground rounded-sm" />
              </div>
            </div>

            {/* App Header */}
            <div className="bg-surface px-4 py-4 border-b border-border">
              <h3 className="text-base font-bold text-foreground mb-1">My Clients</h3>
              <p className="text-xs text-muted-foreground">4 active projects</p>
            </div>

            {/* Client List */}
            <div className="p-4 space-y-3 h-[420px] overflow-y-auto">
              {[
                { name: 'Fitness Studio', tasks: 12, color: 'bg-primary' },
                { name: 'Beauty Salon', tasks: 8, color: 'bg-accent' },
                { name: 'Restaurant', tasks: 15, color: 'bg-[#F59E0B]' },
                { name: 'Real Estate', tasks: 6, color: 'bg-[#8B5CF6]' }
              ].map((client, index) => (
                <motion.div
                  key={index}
                  className="bg-card border border-border rounded-xl p-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.68 + index * 0.12, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 ${client.color} rounded-lg flex items-center justify-center`}>
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground">{client.name}</div>
                      <div className="text-xs text-muted-foreground">{client.tasks} active tasks</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="flex-1 bg-background rounded-lg px-3 py-2 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs text-foreground">{Math.floor(client.tasks / 2)} posts</span>
                    </div>
                    <div className="flex-1 bg-background rounded-lg px-3 py-2 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-warning" />
                      <span className="text-xs text-foreground">{Math.floor(client.tasks / 3)} due</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Bottom Nav */}
            <div className="absolute bottom-0 left-0 right-0 bg-surface border-t border-border px-6 py-3 flex justify-around">
              <div className="flex flex-col items-center gap-1">
                <Users className="w-5 h-5 text-primary" />
                <span className="text-xs text-primary font-medium">Clients</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Calendar</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Tasks</span>
              </div>
            </div>
          </div>
        </div>

        {/* Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-accent/10 rounded-[2.5rem] blur-2xl -z-10 scale-105" />
      </div>
    </motion.div>
  );
}
