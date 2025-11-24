import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, LayoutDashboard, Palette, Share2, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PortalPreviewProps {
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  layoutStyle: string;
  fontPrimary: string;
  fontSecondary: string;
}

export function PortalPreview({
  logoUrl,
  primaryColor,
  accentColor,
  layoutStyle,
  fontPrimary,
  fontSecondary,
}: PortalPreviewProps) {
  const navItems = [
    { icon: LayoutDashboard, label: 'Overview' },
    { icon: Lightbulb, label: 'Ideas' },
    { icon: Palette, label: 'Branding' },
    { icon: Share2, label: 'Social' },
  ];

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
        <div className="border rounded-lg overflow-hidden bg-background" style={{ height: '500px' }}>
          <div className="flex h-full">
            {/* Sidebar Preview */}
            <aside 
              className={cn("border-r flex flex-col", getSidebarWidth())}
              style={{ fontFamily: fontPrimary }}
            >
              {/* Logo */}
              <div className="p-4 border-b">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
                ) : (
                  <div className="h-10 bg-muted rounded" />
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
                        idx === 0 ? "text-white" : "text-muted-foreground hover:bg-accent/50"
                      )}
                      style={idx === 0 ? { backgroundColor: primaryColor } : {}}
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
              <header className="border-b p-4" style={{ fontFamily: fontPrimary }}>
                <h1 className="text-xl font-semibold">Client Portal</h1>
              </header>

              {/* Content Area */}
              <div className="flex-1 p-6 space-y-4" style={{ fontFamily: fontSecondary }}>
                <Card className={getBorderRadius()}>
                  <CardHeader>
                    <CardTitle>Welcome Back</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Your latest updates and activity
                    </p>
                    <div className="space-y-2">
                      <Button 
                        className={getBorderRadius()} 
                        style={{ backgroundColor: primaryColor }}
                      >
                        View Projects
                      </Button>
                      <Button 
                        variant="outline" 
                        className={getBorderRadius()}
                        style={{ borderColor: accentColor, color: accentColor }}
                      >
                        Settings
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className={getBorderRadius()}>
                      <CardContent className="pt-6">
                        <Badge 
                          className={getBorderRadius()}
                          style={{ backgroundColor: accentColor }}
                        >
                          Badge {i}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
