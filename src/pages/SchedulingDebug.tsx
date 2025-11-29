import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { convertToUTC, convertToLocal } from '@/lib/utils';
import { Calendar, Clock, Globe, RefreshCw } from 'lucide-react';

export default function SchedulingDebug() {
  const [userTimezone, setUserTimezone] = useState<string>('UTC');
  const [localNow, setLocalNow] = useState<Date>(new Date());
  const [utcNow, setUtcNow] = useState<Date>(new Date());
  const [testDateTime, setTestDateTime] = useState<string>('');
  const [convertedUTC, setConvertedUTC] = useState<string>('');
  const [convertedLocal, setConvertedLocal] = useState<string>('');
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    fetchUserTimezone();
    fetchScheduledProjects();
    
    // Update clocks every second
    const interval = setInterval(() => {
      setLocalNow(new Date());
      setUtcNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const fetchUserTimezone = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .single();

    setUserTimezone(profile?.timezone || 'UTC');
  };

  const fetchScheduledProjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: agencyMember } = await supabase
      .from('agency_members')
      .select('agency_id')
      .eq('user_id', user.id)
      .single();

    if (!agencyMember) return;

    const { data } = await supabase
      .from('projects')
      .select('id, title, scheduled_time, pipeline_stage')
      .eq('agency_id', agencyMember.agency_id)
      .not('scheduled_time', 'is', null)
      .order('scheduled_time', { ascending: true })
      .limit(10);

    setProjects(data || []);
  };

  const handleTestConversion = () => {
    if (!testDateTime) return;

    const localDate = new Date(testDateTime);
    const utcString = convertToUTC(localDate, userTimezone);
    const backToLocal = convertToLocal(utcString, userTimezone);

    setConvertedUTC(new Date(utcString).toISOString());
    setConvertedLocal(backToLocal.toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: userTimezone,
    }));
  };

  const formatLocalTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: userTimezone,
    });
  };

  const formatUTCTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'UTC',
    }) + ' UTC';
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Scheduling Debug</h1>
        <p className="text-muted-foreground">
          Diagnostic tool for timezone and scheduling system
        </p>
      </div>

      {/* Current Timezone */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Your Timezone</h2>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-base px-4 py-2">
              {userTimezone}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Detected timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </p>
        </div>
      </Card>

      {/* Live Clocks */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Local Time</h2>
          </div>
          <div className="text-2xl font-mono">{formatLocalTime(localNow)}</div>
          <p className="text-sm text-muted-foreground mt-2">
            ({userTimezone})
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">UTC Time</h2>
          </div>
          <div className="text-2xl font-mono">{formatUTCTime(utcNow)}</div>
          <p className="text-sm text-muted-foreground mt-2">
            (Server timezone)
          </p>
        </Card>
      </div>

      {/* Conversion Test */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Conversion Test</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-datetime">Pick a local date/time:</Label>
            <div className="flex gap-2">
              <Input
                id="test-datetime"
                type="datetime-local"
                value={testDateTime}
                onChange={(e) => setTestDateTime(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleTestConversion}>Convert</Button>
            </div>
          </div>

          {convertedUTC && (
            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium mb-1">Stored in DB (UTC):</p>
                <code className="text-sm bg-background px-2 py-1 rounded">
                  {convertedUTC}
                </code>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Displayed to user ({userTimezone}):</p>
                <code className="text-sm bg-background px-2 py-1 rounded">
                  {convertedLocal}
                </code>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Scheduled Projects */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Scheduled Projects</h2>
        </div>
        {projects.length === 0 ? (
          <p className="text-muted-foreground">No scheduled projects</p>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const localTime = convertToLocal(project.scheduled_time, userTimezone);
              return (
                <div key={project.id} className="p-3 border rounded-lg space-y-1">
                  <p className="font-medium">{project.title}</p>
                  <div className="text-sm space-y-1">
                    <p className="text-muted-foreground">
                      UTC (DB): <code className="bg-muted px-1 rounded">{project.scheduled_time}</code>
                    </p>
                    <p className="text-muted-foreground">
                      Local ({userTimezone}): <code className="bg-muted px-1 rounded">
                        {localTime.toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                          timeZone: userTimezone,
                        })}
                      </code>
                    </p>
                  </div>
                  <Badge variant="outline">{project.pipeline_stage}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
