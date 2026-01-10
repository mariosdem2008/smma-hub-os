import { motion } from "framer-motion";
import { FileText, Calendar, MessageSquare } from "lucide-react";

export function OutputExamples() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Strategy Excerpt */}
      <motion.div
        className="p-6 rounded-lg bg-card border border-border"
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Strategy Excerpt</h3>
            <p className="text-xs text-muted-foreground">Monthly content strategy</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="p-3 rounded-lg bg-surface border border-border">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
              Theme: Authority Building
            </p>
            <p className="text-muted-foreground">
              Position client as industry thought leader through case studies and expert insights.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Content Angles
            </p>
            <ul className="space-y-1.5 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                Behind-the-scenes process reveals
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                Client transformation stories
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                Industry myth-busting content
              </li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Weekly Plan */}
      <motion.div
        className="p-6 rounded-lg bg-card border border-border"
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Weekly Plan</h3>
            <p className="text-xs text-muted-foreground">7-day content schedule</p>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {[
            { day: "Mon", type: "Educational carousel", time: "9:00 AM" },
            { day: "Tue", type: "Behind-the-scenes", time: "12:00 PM" },
            { day: "Wed", type: "Client testimonial", time: "3:00 PM" },
            { day: "Thu", type: "Industry tips", time: "9:00 AM" },
            { day: "Fri", type: "Team spotlight", time: "11:00 AM" },
            { day: "Sat", type: "Engagement post", time: "10:00 AM" },
            { day: "Sun", type: "Week recap", time: "6:00 PM" },
          ].map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-surface transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 text-xs font-semibold text-primary">{item.day}</span>
                <span className="text-muted-foreground">{item.type}</span>
              </div>
              <span className="text-xs text-muted-foreground">{item.time}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Post Drafts */}
      <motion.div
        className="p-6 rounded-lg bg-card border border-border"
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Post Drafts</h3>
            <p className="text-xs text-muted-foreground">3 caption variations</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            {
              label: "Professional",
              text: "After implementing our proven framework, our client saw a 340% increase in qualified leads. Here's the methodology...",
            },
            {
              label: "Conversational",
              text: "Real talk: These numbers surprised even us. Here's what happened when we applied consistent execution...",
            },
            {
              label: "Story-driven",
              text: "Most agencies promise results but deliver excuses. Here's how we approach things differently...",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg bg-surface border border-border"
            >
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                {item.label}
              </p>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {item.text}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground text-center">
          AI generates variations based on approved brand voice
        </p>
      </motion.div>
    </div>
  );
}
