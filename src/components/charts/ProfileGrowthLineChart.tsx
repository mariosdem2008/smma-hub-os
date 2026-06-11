import { format } from "date-fns";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ProfileGrowthPoint = {
  date: string;
  followers?: number | null;
  impressions?: number | null;
};

interface ProfileGrowthLineChartProps {
  trends: ProfileGrowthPoint[];
  height?: number;
  showImpressions?: boolean;
  showLegend?: boolean;
}

export function ProfileGrowthLineChart({
  trends,
  height = 300,
  showImpressions = false,
  showLegend = false,
}: ProfileGrowthLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={trends}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" tickFormatter={(value) => format(new Date(value), "MMM d")} className="text-xs" />
        <YAxis className="text-xs" />
        <Tooltip
          labelFormatter={(value) => format(new Date(value), "MMM d, yyyy")}
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
          }}
        />
        {showLegend ? <Legend /> : null}
        <Line
          type="monotone"
          dataKey="followers"
          stroke="hsl(var(--success))"
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Followers"
        />
        {showImpressions ? (
          <Line
            type="monotone"
            dataKey="impressions"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Impressions"
          />
        ) : null}
      </LineChart>
    </ResponsiveContainer>
  );
}
