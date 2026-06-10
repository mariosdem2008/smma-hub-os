import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Search, Type } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FontPickerProps {
  clientId: string;
  label: string;
  value: string | null;
  onChange: (font: string) => void;
  disabled?: boolean;
}

// Popular Google Fonts list
const GOOGLE_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Raleway",
  "Nunito",
  "Playfair Display",
  "Merriweather",
  "PT Sans",
  "Ubuntu",
  "Work Sans",
  "Source Sans Pro",
  "Oswald",
  "Mukta",
  "Libre Baskerville",
  "Crimson Text",
  "Rubik",
  "Barlow",
].sort();

export default function FontPicker({ clientId, label, value, onChange, disabled }: FontPickerProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [customFont, setCustomFont] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set());

  // Load Google Font dynamically
  const loadGoogleFont = (fontFamily: string) => {
    if (loadedFonts.has(fontFamily)) return;

    const link = document.createElement("link");
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, "+")}:wght@400;700&display=swap`;
    link.rel = "stylesheet";
    document.head.appendChild(link);
    
    setLoadedFonts((prev) => new Set([...prev, fontFamily]));
  };

  // Filter fonts based on search
  const filteredFonts = GOOGLE_FONTS.filter((font) =>
    font.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Load fonts for preview
  useEffect(() => {
    filteredFonts.slice(0, 10).forEach(loadGoogleFont);
  }, [searchQuery]);

  const handleGoogleFontSelect = (fontFamily: string) => {
    loadGoogleFont(fontFamily);
    onChange(fontFamily);
  };

  const handleCustomFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["font/woff", "font/woff2", "font/ttf", "application/x-font-ttf", "application/x-font-woff"];
    const validExtensions = [".woff", ".woff2", ".ttf"];
    const hasValidExtension = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!validTypes.includes(file.type) && !hasValidExtension) {
      toast({
        title: "Invalid file type",
        description: "Please upload a .woff, .woff2, or .ttf font file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Upload to storage
      const filePath = `${clientId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("client-fonts")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("client-fonts")
        .getPublicUrl(filePath);

      // Generate font family name from filename
      const fontFamily = file.name.replace(/\.(woff2?|ttf)$/i, "").replace(/[-_]/g, " ");
      
      // Create @font-face rule
      const fontFormat = file.name.endsWith(".woff2") ? "woff2" : file.name.endsWith(".woff") ? "woff" : "truetype";
      const fontFace = `
        @font-face {
          font-family: '${fontFamily}';
          src: url('${publicUrl}') format('${fontFormat}');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
      `;

      // Inject font-face into document
      const styleSheet = document.createElement("style");
      styleSheet.textContent = fontFace;
      document.head.appendChild(styleSheet);

      onChange(`custom:${fontFamily}`);

      toast({
        title: "Success",
        description: "Font uploaded successfully",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload font file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleManualFontEntry = () => {
    if (!customFont.trim()) {
      toast({
        title: "Error",
        description: "Please enter a font family name",
        variant: "destructive",
      });
      return;
    }
    onChange(`manual:${customFont.trim()}`);
    setCustomFont("");
  };

  // Parse current value
  const getCurrentFont = () => {
    if (!value) return null;
    if (value.startsWith("custom:")) return value.replace("custom:", "");
    if (value.startsWith("manual:")) return value.replace("manual:", "");
    return value;
  };

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      
      {/* Current Selection Display */}
      {value && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Font</p>
              <p 
                className="text-lg font-semibold"
                style={{ fontFamily: getCurrentFont() || "inherit" }}
              >
                {getCurrentFont()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange("")}
              disabled={disabled}
            >
              Clear
            </Button>
          </div>
        </Card>
      )}

      <Tabs defaultValue="google" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="google">Google Fonts</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
        </TabsList>

        {/* Google Fonts Tab */}
        <TabsContent value="google" className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search fonts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              disabled={disabled}
            />
          </div>

          <ScrollArea className="h-64 rounded-md border">
            <div className="p-2 space-y-1">
              {filteredFonts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No fonts found
                </p>
              ) : (
                filteredFonts.map((font) => (
                  <button
                    key={font}
                    onClick={() => handleGoogleFontSelect(font)}
                    disabled={disabled}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ fontFamily: font }}
                  >
                    <span className="text-base">{font}</span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-3">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center gap-2 text-center">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Upload Custom Font</p>
                  <p className="text-xs text-muted-foreground">
                    Supports .woff, .woff2, .ttf files
                  </p>
                </div>
              </div>
              
              <Input
                type="file"
                accept=".woff,.woff2,.ttf"
                onChange={handleCustomFontUpload}
                disabled={disabled || uploading}
                className="cursor-pointer"
              />
              
              {uploading && (
                <p className="text-xs text-center text-muted-foreground">
                  Uploading font...
                </p>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Manual Entry Tab */}
        <TabsContent value="manual" className="space-y-3">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center gap-2 text-center">
                <Type className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Enter Font Family Name</p>
                  <p className="text-xs text-muted-foreground">
                    Use this if you have a system font installed
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., Arial, Helvetica, Times New Roman"
                  value={customFont}
                  onChange={(e) => setCustomFont(e.target.value)}
                  disabled={disabled}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleManualFontEntry();
                    }
                  }}
                />
                <Button
                  onClick={handleManualFontEntry}
                  disabled={disabled || !customFont.trim()}
                >
                  Apply
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
