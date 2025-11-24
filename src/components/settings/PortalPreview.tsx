import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, LayoutDashboard, Palette, Share2, Lightbulb, CalendarDays, FolderOpen, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface PortalPreviewProps {
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  layoutStyle: string;
  fontPrimary: string;
  fontSecondary: string;
  headerBgColor?: string;
  sidebarBgColor?: string;
  contentBgColor?: string;
  cardBgColor?: string;
}

export function PortalPreview({
  logoUrl,
  primaryColor,
  accentColor,
  layoutStyle,
  fontPrimary,
  fontSecondary,
  headerBgColor = '#ffffff',
  sidebarBgColor = '#ffffff',
  contentBgColor = '#f9fafb',
  cardBgColor = '#ffffff',
}: PortalPreviewProps) {
  const navItems = [
    { icon: LayoutDashboard, label: 'Overview' },
    { icon: Lightbulb, label: 'Ideas' },
    { icon: Palette, label: 'Branding' },
    { icon: Share2, label: 'Social' },
    { icon: CalendarDays, label: 'Calendar' },
    { icon: FolderOpen, label: 'Assets' },
  ];

  // Apply branding to preview
  const previewStyle = {
    '--preview-primary': primaryColor,
    '--preview-accent': accentColor,
    '--preview-header-bg': headerBgColor,
    '--preview-sidebar-bg': sidebarBgColor,
    '--preview-content-bg': contentBgColor,
    '--preview-card-bg': cardBgColor,
  } as React.CSSProperties;

  const getBorderRadius = () => {
    switch (layoutStyle) {
      case 'minimal': return 'rounded-sm';
      case 'bold': return 'rounded-xl';
      case 'modern': return 'rounded-lg';
      default: return 'rounded-md';
    }
  };

  const getSidebarWidth = () => {
    switch (layoutStyle) {
      case 'minimal': return 'w-16';
      case 'bold': return 'w-72';
      default: return 'w-64';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Live Preview
          </CardTitle>
          <Badge variant="secondary">Preview Mode</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden" style={{ ...previewStyle, height: '600px' }}>
          <div className="flex h-full">
            {/* Sidebar Preview */}
            <aside 
              className={cn("border-r flex flex-col", getSidebarWidth())}
              style={{ fontFamily: fontPrimary, backgroundColor: 'var(--preview-sidebar-bg)' }}
            >
              {/* Logo */}
              <div className="p-4 border-b">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
                ) : (
                  <div className="h-10 bg-muted/20 rounded" />
                )}
              </div>
              
              {/* Nav Items */}
              <nav className="flex-1 p-2 space-y-1">
                {navItems.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                        getBorderRadius(),
                        idx === 0 ? "text-white" : "text-muted-foreground"
                      )}
                      style={idx === 0 ? { backgroundColor: 'var(--preview-primary)' } : {}}
                    >
                      <Icon className="h-4 w-4" />
                      {layoutStyle !== 'minimal' && <span>{item.label}</span>}
                    </div>
                  );
                })}
              </nav>
            </aside>

            {/* Main Content Preview */}
            <div className="flex-1 flex flex-col">
              {/* Header */}
              <header 
                className="border-b p-4" 
                style={{ 
                  fontFamily: fontPrimary,
                  backgroundColor: 'var(--preview-header-bg)'
                }}
              >
                <h1 className="text-xl font-semibold">Client Portal</h1>
              </header>

              {/* Tabs */}
              <div className="border-b px-4" style={{ backgroundColor: 'var(--preview-header-bg)' }}>
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="bg-transparent h-auto p-0 space-x-4">
                    <TabsTrigger 
                      value="overview" 
                      className="data-[state=active]:border-b-2 rounded-none px-0 pb-2"
                      style={{ borderColor: 'var(--preview-primary)' }}
                    >
                      <LayoutDashboard className="h-4 w-4 mr-2" />
                      Overview
                    </TabsTrigger>
                    <TabsTrigger value="ideas" className="data-[state=inactive]:bg-transparent rounded-none px-0 pb-2">
                      <Lightbulb className="h-4 w-4 mr-2" />
                      Ideas
                    </TabsTrigger>
                    <TabsTrigger value="assets" className="data-[state=inactive]:bg-transparent rounded-none px-0 pb-2">
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Assets
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Content Area */}
              <div 
                className="flex-1 p-6 space-y-4 overflow-auto" 
                style={{ 
                  fontFamily: fontSecondary,
                  backgroundColor: 'var(--preview-content-bg)'
                }}
              >
                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { icon: CalendarDays, label: 'Posts', value: '12', color: 'var(--preview-primary)' },
                    { icon: Lightbulb, label: 'Ideas', value: '8', color: 'var(--preview-accent)' },
                    { icon: FolderOpen, label: 'Assets', value: '24', color: '#3b82f6' }
                  ].map((stat, i) => (
                    <div 
                      key={i} 
                      className={cn("p-4 border", getBorderRadius())}
                      style={{ backgroundColor: 'var(--preview-card-bg)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="rounded-full p-2"
                          style={{ backgroundColor: `${stat.color}20` }}
                        >
                          <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{stat.label}</p>
                          <p className="text-xl font-bold">{stat.value}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Main Card */}
                <div 
                  className={cn("border p-6", getBorderRadius())}
                  style={{ backgroundColor: 'var(--preview-card-bg)' }}
                >
                  <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: fontPrimary }}>
                    Brand Information
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your brand assets and guidelines
                  </p>
                  <div className="space-y-3">
                    <Button 
                      size="sm"
                      className={getBorderRadius()} 
                      style={{ backgroundColor: 'var(--preview-primary)', color: 'white' }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Guidelines
                    </Button>
                    <div className="flex gap-2">
                      <Badge 
                        className={getBorderRadius()}
                        style={{ backgroundColor: 'var(--preview-accent)', color: 'white' }}
                      >
                        Active
                      </Badge>
                      <Badge 
                        variant="outline"
                        className={getBorderRadius()}
                      >
                        Updated
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
