// ============================================================================
// AI Scan Step - Shows extracted data from website/socials scan
// ============================================================================

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, Edit2, RefreshCw, Sparkles, Users, Target, Zap, Building2 } from 'lucide-react';
import { StepLayout } from '../components/StepLayout';
import { useOnboarding } from '../OnboardingContext';
import { cn } from '@/lib/utils';

interface ScanSection {
  key: string;
  title: string;
  icon: React.ReactNode;
  data: string[] | string | null;
  accepted: boolean;
}

export function AiScanStep() {
  const { state, updateProfile, nextStep, prevStep, getCurrentStep, setAiScanLoading, setAiScanResult } = useOnboarding();
  const currentStep = getCurrentStep();

  const [acceptedSections, setAcceptedSections] = useState<Record<string, boolean>>({
    niche: false,
    business_model: false,
    audience: false,
    competitors: false,
    differentiators: false,
  });

  const scanResult = state.aiScanResult;
  const isScanning = state.aiScanLoading;

  // Build sections from scan result
  const sections: ScanSection[] = [
    {
      key: 'niche',
      title: 'Detected Niche',
      icon: <Target className="h-4 w-4" />,
      data: scanResult?.extracted?.niche ?? null,
      accepted: acceptedSections.niche,
    },
    {
      key: 'business_model',
      title: 'Business Model',
      icon: <Building2 className="h-4 w-4" />,
      data: scanResult?.extracted?.business_model ?? null,
      accepted: acceptedSections.business_model,
    },
    {
      key: 'audience',
      title: 'Target Audience',
      icon: <Users className="h-4 w-4" />,
      data: scanResult?.extracted?.audience ?? null,
      accepted: acceptedSections.audience,
    },
    {
      key: 'competitors',
      title: 'Competitors Found',
      icon: <Zap className="h-4 w-4" />,
      data: scanResult?.extracted?.competitors?.map((c) => c.name) ?? null,
      accepted: acceptedSections.competitors,
    },
    {
      key: 'differentiators',
      title: 'Unique Differentiators',
      icon: <Sparkles className="h-4 w-4" />,
      data: scanResult?.extracted?.differentiators ?? null,
      accepted: acceptedSections.differentiators,
    },
  ];

  const handleAcceptSection = (key: string) => {
    setAcceptedSections((prev) => ({ ...prev, [key]: true }));
  };

  const handleAcceptAll = () => {
    const allAccepted: Record<string, boolean> = {};
    sections.forEach((s) => {
      if (s.data) allAccepted[s.key] = true;
    });
    setAcceptedSections(allAccepted);
  };

  const handleRescan = async () => {
    if (!state.profile.q2_website) return;

    setAiScanLoading(true);
    try {
      // TODO: Call ai-onboarding-scan edge function
      // For now, simulate a scan with mock data
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setAiScanResult({
        extracted: {
          niche: 'Digital Marketing Agency',
          business_model: 'b2b',
          audience: ['Small business owners', 'Marketing managers', 'Startup founders'],
          competitors: [
            { name: 'Agency A', handle: '@agencya' },
            { name: 'Agency B', url: 'https://agencyb.com' },
          ],
          offers: ['Social Media Management', 'Content Creation'],
          differentiators: ['AI-powered insights', 'White-glove service', 'Industry specialization'],
          pain_points: ['Low engagement', 'No content strategy', 'Inconsistent posting'],
        },
        confidence: 75,
        source_urls: [state.profile.q2_website ?? ''],
        cached_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setAiScanLoading(false);
    }
  };

  const handleNext = () => {
    // Apply accepted scan data to profile
    if (scanResult?.extracted) {
      const updates: Record<string, unknown> = {
        ai_scan_result: scanResult,
        ai_scan_at: new Date().toISOString(),
        ai_scan_accepted: Object.values(acceptedSections).some(Boolean),
      };

      // Prefill fields based on accepted sections
      if (acceptedSections.business_model && scanResult.extracted.business_model) {
        updates.q7_business_model = scanResult.extracted.business_model;
        updates.q7_provenance = 'ai_prefilled';
      }

      updateProfile(updates);
    }

    nextStep();
  };

  const acceptedCount = Object.values(acceptedSections).filter(Boolean).length;
  const availableCount = sections.filter((s) => s.data).length;
  const canProceed = !isScanning;

  // Loading state
  if (isScanning) {
    return (
      <StepLayout
        title="Scanning business..."
        description="Analyzing website and social profiles"
        stepNumber={currentStep?.stepNumber ?? 3}
        totalSteps={state.steps.length}
        canGoBack={true}
        canProceed={false}
        isSaving={false}
        onBack={prevStep}
        onNext={() => {}}
      >
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">This usually takes 10-20 seconds...</p>
        </div>
      </StepLayout>
    );
  }

  // No scan result yet
  if (!scanResult) {
    return (
      <StepLayout
        title="AI Scan"
        description="We'll analyze the website to prefill some questions"
        stepNumber={currentStep?.stepNumber ?? 3}
        totalSteps={state.steps.length}
        canGoBack={true}
        canProceed={true}
        isSaving={false}
        onBack={prevStep}
        onNext={nextStep}
      >
        <div className="flex flex-col items-center justify-center py-12 space-y-6">
          <div className="text-center space-y-2">
            <Sparkles className="h-12 w-12 text-primary mx-auto" />
            <h3 className="text-lg font-medium">Ready to scan</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              We'll analyze {state.profile.q2_website} to extract business information
              and prefill some of the onboarding questions.
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleRescan} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Start Scan
            </Button>
            <Button variant="outline" onClick={nextStep}>
              Skip for now
            </Button>
          </div>
        </div>
      </StepLayout>
    );
  }

  return (
    <StepLayout
      title={currentStep?.title ?? 'Review AI Scan Results'}
      description={`We found ${availableCount} data points. Accept what looks correct.`}
      stepNumber={currentStep?.stepNumber ?? 3}
      totalSteps={state.steps.length}
      canGoBack={true}
      canProceed={canProceed}
      isSaving={state.isSaving}
      onBack={prevStep}
      onNext={handleNext}
    >
      <div className="space-y-6">
        {/* Confidence indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={scanResult.confidence >= 70 ? 'default' : 'secondary'}>
              {scanResult.confidence}% confidence
            </Badge>
            <span className="text-sm text-muted-foreground">
              {acceptedCount} of {availableCount} accepted
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRescan} className="gap-1">
              <RefreshCw className="h-3 w-3" />
              Rescan
            </Button>
            {availableCount > 0 && acceptedCount < availableCount && (
              <Button size="sm" onClick={handleAcceptAll} className="gap-1">
                <Check className="h-3 w-3" />
                Accept All
              </Button>
            )}
          </div>
        </div>

        {/* Scan result sections */}
        <div className="grid gap-4">
          {sections.map((section) => {
            if (!section.data) return null;

            const isArray = Array.isArray(section.data);
            const displayData = isArray ? section.data : [section.data];

            return (
              <Card
                key={section.key}
                className={cn(
                  'transition-all duration-200',
                  section.accepted && 'border-primary bg-primary/5'
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      {section.icon}
                      {section.title}
                    </CardTitle>
                    {section.accepted ? (
                      <Badge variant="default" className="gap-1">
                        <Check className="h-3 w-3" />
                        Accepted
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAcceptSection(section.key)}
                      >
                        Accept
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {displayData.map((item, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className={cn(
                          section.accepted && 'border-primary/50 bg-primary/10'
                        )}
                      >
                        {item}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* No data found */}
        {availableCount === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                No data could be extracted. You can continue and fill in the details manually.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </StepLayout>
  );
}
