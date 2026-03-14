import { motion } from "framer-motion";
import { Calendar, Instagram, Facebook, Linkedin } from "lucide-react";

export default function CalendarMockup() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeks = [
    [null, null, null, 1, 2, 3, 4],
    [5, 6, 7, 8, 9, 10, 11],
    [12, 13, 14, 15, 16, 17, 18],
    [19, 20, 21, 22, 23, 24, 25],
    [26, 27, 28, 29, 30, null, null]
  ];

  const postsData: Record<number, { platform: string; color: string; icon: any }[]> = {
    5: [{ platform: 'IG', color: 'bg-pink-500', icon: Instagram }],
    8: [
      { platform: 'FB', color: 'bg-blue-500', icon: Facebook },
      { platform: 'IG', color: 'bg-pink-500', icon: Instagram }
    ],
    12: [{ platform: 'LI', color: 'bg-blue-600', icon: Linkedin }],
    15: [
      { platform: 'IG', color: 'bg-pink-500', icon: Instagram },
      { platform: 'FB', color: 'bg-blue-500', icon: Facebook }
    ],
    19: [{ platform: 'IG', color: 'bg-pink-500', icon: Instagram }],
    22: [
      { platform: 'FB', color: 'bg-blue-500', icon: Facebook },
      { platform: 'LI', color: 'bg-blue-600', icon: Linkedin }
    ],
    26: [{ platform: 'IG', color: 'bg-pink-500', icon: Instagram }]
  };

  return (
    <motion.div 
      className="rounded-xl border-2 border-border bg-surface shadow-xl overflow-hidden"
    >
      <div className="p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h4 className="text-lg font-semibold text-foreground">December 2024</h4>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-lg hover:bg-muted transition-colors">
              Today
            </button>
            <button className="px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-lg hover:bg-muted transition-colors">
              Month
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="space-y-2">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {days.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 gap-2">
              {week.map((day, dayIdx) => (
                <motion.div
                  key={dayIdx}
                  className={`aspect-square rounded-lg border ${
                    day === null
                      ? 'bg-transparent border-transparent'
                      : day === 15
                      ? 'bg-primary/10 border-primary'
                      : 'bg-card border-border hover:border-primary/50'
                  } transition-colors cursor-pointer flex flex-col items-center justify-center relative`}
                >
                  {day && (
                    <>
                      <span className={`text-xs font-medium ${
                        day === 15 ? 'text-primary' : 'text-foreground'
                      }`}>
                        {day}
                      </span>
                      {postsData[day] && (
                        <div className="absolute bottom-1 flex gap-0.5">
                          {postsData[day].map((post, i) => {
                            const Icon = post.icon;
                            return (
                              <div
                                key={i}
                                className={`w-1.5 h-1.5 rounded-full ${post.color}`}
                                title={post.platform}
                              />
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-pink-500" />
            <span className="text-muted-foreground">Instagram</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Facebook</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-600" />
            <span className="text-muted-foreground">LinkedIn</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
