import { motion } from "framer-motion";
import { Users, UserPlus, Shield, Crown } from "lucide-react";

export default function TeamMockup() {
  const members = [
    { name: 'Sarah Johnson', role: 'Owner', avatar: 'SJ', color: 'bg-primary', icon: Crown },
    { name: 'Mike Chen', role: 'Manager', avatar: 'MC', color: 'bg-accent', icon: Shield },
    { name: 'Emily Davis', role: 'Creator', avatar: 'ED', color: 'bg-[#8B5CF6]', icon: null },
    { name: 'Tom Wilson', role: 'Creator', avatar: 'TW', color: 'bg-[#F59E0B]', icon: null }
  ];

  return (
    <motion.div 
      className="rounded-xl border-2 border-border bg-surface shadow-xl overflow-hidden"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h4 className="text-lg font-semibold text-foreground">Team Members</h4>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
            <UserPlus className="w-3.5 h-3.5" />
            Invite
          </button>
        </div>

        {/* Team List */}
        <div className="space-y-3">
          {members.map((member, index) => {
            const Icon = member.icon;
            return (
              <motion.div
                key={index}
                className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className={`w-10 h-10 ${member.color} rounded-full flex items-center justify-center text-white font-semibold text-sm relative`}>
                  {member.avatar}
                  {Icon && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-background border-2 border-background rounded-full flex items-center justify-center">
                      <Icon className="w-3 h-3 text-primary" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">{member.name}</div>
                  <div className="text-xs text-muted-foreground">{member.role}</div>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-background border border-border rounded text-xs hover:bg-muted transition-colors">
                    Edit
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Invite Section */}
        <motion.div 
          className="mt-6 p-4 bg-primary/5 border-2 border-dashed border-primary/30 rounded-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h5 className="text-sm font-semibold text-foreground mb-1">Invite Team Members</h5>
              <p className="text-xs text-muted-foreground mb-3">
                Collaborate with your team by inviting members with specific roles
              </p>
              <div className="flex gap-2">
                <input 
                  type="email" 
                  placeholder="email@example.com"
                  className="flex-1 px-3 py-1.5 bg-background border border-border rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button className="px-4 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary/90 transition-colors">
                  Send Invite
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-card border border-border rounded-lg">
            <div className="text-lg font-bold text-foreground">4</div>
            <div className="text-xs text-muted-foreground">Members</div>
          </div>
          <div className="text-center p-3 bg-card border border-border rounded-lg">
            <div className="text-lg font-bold text-foreground">2</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
          <div className="text-center p-3 bg-card border border-border rounded-lg">
            <div className="text-lg font-bold text-foreground">24</div>
            <div className="text-xs text-muted-foreground">Clients</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
