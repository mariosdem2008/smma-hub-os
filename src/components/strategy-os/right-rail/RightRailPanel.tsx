// Strategy OS - Right Rail Panel

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStrategyOS } from '../StrategyOSContext';
import { DecisionsTab } from './DecisionsTab';
import { HistoryTab } from './HistoryTab';
import { TasksTab } from './TasksTab';
import { RIGHT_RAIL_TABS } from '@/lib/strategy/constants';
import { Scale, History, ListTodo } from 'lucide-react';

const tabIcons = {
  decisions: Scale,
  history: History,
  tasks: ListTodo,
};

export function RightRailPanel() {
  const { rightRailTab, setRightRailTab } = useStrategyOS();

  return (
    <div className="h-full flex flex-col">
      <Tabs
        value={rightRailTab}
        onValueChange={(v) => setRightRailTab(v as typeof rightRailTab)}
        className="flex flex-col h-full"
      >
        {/* Tab List */}
        <div className="border-b border-border/50 px-2 py-2">
          <TabsList className="w-full grid grid-cols-3 h-9">
            {RIGHT_RAIL_TABS.map((tab) => {
              const Icon = tabIcons[tab.key];
              return (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="text-xs gap-1 px-2"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tab.label.split(' ')[0]}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          <TabsContent value="decisions" className="h-full m-0 p-0 overflow-y-auto">
            <DecisionsTab />
          </TabsContent>
          <TabsContent value="history" className="h-full m-0 p-0 overflow-y-auto">
            <HistoryTab />
          </TabsContent>
          <TabsContent value="tasks" className="h-full m-0 p-0 overflow-y-auto">
            <TasksTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default RightRailPanel;
