import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AspectRatioWarningProps {
  aspectRatio: { width: number; height: number };
  selectedPlatforms: string[];
}

export function AspectRatioWarning({ aspectRatio, selectedPlatforms }: AspectRatioWarningProps) {
  if (selectedPlatforms.length === 0) return null;

  const ratio = aspectRatio.width / aspectRatio.height;
  const warnings: string[] = [];

  // Check vertical platforms (9:16)
  const verticalPlatforms = selectedPlatforms.filter(p => 
    ['tiktok', 'instagram', 'youtube'].includes(p)
  );
  if (verticalPlatforms.length > 0 && Math.abs(ratio - 0.5625) > 0.1) {
    warnings.push(`${verticalPlatforms.join(', ')} recommend 9:16 aspect ratio (1080x1920)`);
  }

  // Check horizontal/square platforms (16:9 or 1:1)
  const horizontalPlatforms = selectedPlatforms.filter(p => 
    ['facebook', 'linkedin'].includes(p)
  );
  if (horizontalPlatforms.length > 0) {
    const isHorizontal = Math.abs(ratio - 1.778) < 0.1; // 16/9
    const isSquare = Math.abs(ratio - 1) < 0.1;
    if (!isHorizontal && !isSquare) {
      warnings.push(`${horizontalPlatforms.join(', ')} recommend 16:9 (1920x1080) or 1:1 (1080x1080) aspect ratio`);
    }
  }

  if (warnings.length === 0) return null;

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Aspect Ratio Mismatch</AlertTitle>
      <AlertDescription>
        <ul className="list-disc list-inside space-y-1 mt-2">
          {warnings.map((warning, index) => (
            <li key={index} className="text-sm">{warning}</li>
          ))}
        </ul>
        <p className="text-sm mt-2">
          Current aspect ratio: {ratio.toFixed(2)} ({aspectRatio.width}x{aspectRatio.height})
        </p>
      </AlertDescription>
    </Alert>
  );
}
