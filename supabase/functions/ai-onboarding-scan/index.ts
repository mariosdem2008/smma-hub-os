// ============================================================================
// AI Onboarding Scan Edge Function
// Scans website and social profiles to extract business information
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { runAiTask } from "../_shared/ai.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import { objectSchema } from "../../../src/ai/schema.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";

interface ScanRequest {
  agency_id: string;
  client_id: string;
  website: string;
  social_links?: string[];
}

interface ScanResult {
  extracted: {
    niche?: string;
    business_model?: 'b2b' | 'b2c' | 'both';
    audience?: string[];
    competitors?: { name: string; handle?: string; url?: string }[];
    offers?: string[];
    differentiators?: string[];
    pain_points?: string[];
    cta?: string;
  };
  confidence: number;
  source_urls: string[];
  cached_at: string;
}

// ============================================================================
// SSRF Protection
// ============================================================================

const PRIVATE_IP_RANGES = [
  /^127\./,                    // Loopback
  /^10\./,                     // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B
  /^192\.168\./,               // Private Class C
  /^169\.254\./,               // Link-local
  /^0\./,                      // Current network
  /^::1$/,                     // IPv6 loopback
  /^fc00:/i,                   // IPv6 private
  /^fe80:/i,                   // IPv6 link-local
  /^localhost$/i,
  /^.*\.local$/i,
  /^.*\.internal$/i,
];

const ALLOWED_CONTENT_TYPES = [
  'text/html',
  'text/plain',
  'application/xhtml+xml',
];

const MAX_RESPONSE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_REDIRECTS = 2;
const FETCH_TIMEOUT = 10000; // 10 seconds

function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Check against private IP patterns
    for (const pattern of PRIVATE_IP_RANGES) {
      if (pattern.test(hostname)) {
        return true;
      }
    }

    // Block non-http(s) protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return true;
    }

    // Block URLs with credentials
    if (url.username || url.password) {
      return true;
    }

    return false;
  } catch {
    return true; // Invalid URL = blocked
  }
}

function validateUrl(url: string): string | null {
  try {
    // Normalize URL
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(normalizedUrl);

    // SSRF check
    if (isPrivateUrl(normalizedUrl)) {
      console.error(`SSRF blocked: ${normalizedUrl}`);
      return null;
    }

    return normalizedUrl;
  } catch {
    return null;
  }
}

// Safe website content fetcher with SSRF protections
async function fetchWebsiteContent(url: string): Promise<string | null> {
  const validatedUrl = validateUrl(url);
  if (!validatedUrl) {
    console.error(`Invalid or blocked URL: ${url}`);
    return null;
  }

  let redirectCount = 0;
  let currentUrl = validatedUrl;

  while (redirectCount <= MAX_REDIRECTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const response = await fetch(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SMMHubBot/1.0)',
          'Accept': 'text/html,text/plain,application/xhtml+xml',
        },
        redirect: 'manual', // Handle redirects manually for SSRF protection
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle redirects manually
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          console.error(`Redirect without location header from ${currentUrl}`);
          return null;
        }

        // Resolve relative URLs
        const redirectUrl = new URL(location, currentUrl).toString();

        // Validate redirect target
        if (isPrivateUrl(redirectUrl)) {
          console.error(`SSRF blocked on redirect: ${redirectUrl}`);
          return null;
        }

        currentUrl = redirectUrl;
        redirectCount++;
        continue;
      }

      if (!response.ok) {
        console.error(`Failed to fetch ${currentUrl}: ${response.status}`);
        return null;
      }

      // Validate content type
      const contentType = response.headers.get('content-type') || '';
      const isAllowedType = ALLOWED_CONTENT_TYPES.some((allowed) =>
        contentType.toLowerCase().includes(allowed)
      );

      if (!isAllowedType) {
        console.error(`Blocked content type: ${contentType} from ${currentUrl}`);
        return null;
      }

      // Check content length if available
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
        console.error(`Response too large: ${contentLength} bytes from ${currentUrl}`);
        return null;
      }

      // Read response with size limit
      const reader = response.body?.getReader();
      if (!reader) return null;

      const chunks: Uint8Array[] = [];
      let totalSize = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalSize += value.length;
        if (totalSize > MAX_RESPONSE_SIZE) {
          console.error(`Response exceeded size limit during read from ${currentUrl}`);
          reader.cancel();
          return null;
        }

        chunks.push(value);
      }

      const html = new TextDecoder().decode(
        chunks.reduce((acc, chunk) => {
          const merged = new Uint8Array(acc.length + chunk.length);
          merged.set(acc);
          merged.set(chunk, acc.length);
          return merged;
        }, new Uint8Array())
      );

      // Sanitize HTML - strip scripts, styles, and extract text
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
        .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
        .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
        .replace(/<embed[^>]*>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 10000); // Limit to first 10k chars

      return textContent;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`Timeout fetching ${currentUrl}`);
      } else {
        console.error(`Error fetching ${currentUrl}:`, error);
      }
      return null;
    }
  }

  console.error(`Too many redirects for ${url}`);
  return null;
}

// AI analysis using router-backed AI
async function analyzeWithAI(
  content: string,
  socialContent: string[],
  opts: { agencyId: string; clientId: string; userId: string; supabase: any }
): Promise<ScanResult['extracted']> {
  const prompt = `Analyze this business website and social media content to extract key information.

Website Content:
${content.slice(0, 5000)}

${socialContent.length > 0 ? `Social Media Content:\n${socialContent.join('\n').slice(0, 2000)}` : ''}

Extract the following in JSON format:
{
  "niche": "The business niche/industry (1-3 words)",
  "business_model": "b2b" or "b2c" or "both",
  "audience": ["5-8 target audience descriptions"],
  "competitors": [{"name": "competitor name", "url": "if found"}],
  "offers": ["3-5 main products/services offered"],
  "differentiators": ["5-8 unique selling points or differentiators"],
  "pain_points": ["5-8 customer pain points the business solves"],
  "cta": "The main call-to-action found on the site"
}

Only include fields where you have reasonable confidence. Return valid JSON only.`;

  try {
    const result = await runAiTask({
      task_type: TaskType.EXTRACT_STRUCTURED,
      tenant: {
        agency_id: opts.agencyId,
        client_id: opts.clientId,
        user_id: opts.userId,
      },
      input: { message: prompt },
      metadata: {
        instructions: "Return only valid JSON object. Do not include markdown.",
        providerOverride: "anthropic",
        modelOverride: "claude-3-5-haiku-20241022",
      },
      outputSchema: objectSchema("onboarding_scan", []),
      supabase: opts.supabase,
    });

    if (result?.json && typeof result.json === "object" && !Array.isArray(result.json)) {
      return result.json as ScanResult["extracted"];
    }
    return {};
  } catch (error) {
    console.error("ai_onboarding_scan_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

// Calculate confidence score based on extracted data
function calculateConfidence(extracted: ScanResult['extracted']): number {
  let score = 0;
  let maxScore = 0;

  const weights = {
    niche: 15,
    business_model: 10,
    audience: 20,
    competitors: 10,
    offers: 15,
    differentiators: 15,
    pain_points: 10,
    cta: 5,
  };

  for (const [key, weight] of Object.entries(weights)) {
    maxScore += weight;
    const value = extracted[key as keyof typeof extracted];

    if (value) {
      if (Array.isArray(value) && value.length > 0) {
        score += weight * Math.min(value.length / 3, 1);
      } else if (typeof value === 'string' && value.length > 0) {
        score += weight;
      }
    }
  }

  return Math.round((score / maxScore) * 100);
}

serve(async (req) => {
  const headers = corsHeaders(req);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    const guardResponse = getEndpointGuardResponse("ai-onboarding-scan", headers);
    if (guardResponse) return guardResponse;

    const body: ScanRequest = await req.json();
    const { agency_id, client_id, website, social_links = [] } = body;

    if (!agency_id || !client_id || !website) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: agency_id, client_id, website' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Validate website URL
    if (!validateUrl(website)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or blocked website URL' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const { data: membership } = await supabase
      .from('agency_members')
      .select('id')
      .eq('agency_id', agency_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Not a member of this agency' }),
        { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Check for cached result
    const { data: existingProfile } = await supabase
      .from('client_onboarding_profiles')
      .select('ai_scan_result, ai_scan_at')
      .eq('client_id', client_id)
      .single();

    // If cached and less than 7 days old, return cached result
    if (existingProfile?.ai_scan_result && existingProfile?.ai_scan_at) {
      const cachedAt = new Date(existingProfile.ai_scan_at);
      const now = new Date();
      const daysDiff = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff < 7) {
        return new Response(
          JSON.stringify(existingProfile.ai_scan_result),
          { headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch website content
    const websiteContent = await fetchWebsiteContent(website);

    // Fetch social content - validate each URL
    const socialContent: string[] = [];
    for (const link of social_links.slice(0, 3)) {
      if (validateUrl(link)) {
        const content = await fetchWebsiteContent(link);
        if (content) {
          socialContent.push(content.slice(0, 2000));
        }
      }
    }

    // If no content could be fetched, return empty result
    if (!websiteContent && socialContent.length === 0) {
      const emptyResult: ScanResult = {
        extracted: {},
        confidence: 0,
        source_urls: [website, ...social_links],
        cached_at: new Date().toISOString(),
      };

      return new Response(
        JSON.stringify(emptyResult),
        { headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze with AI
    const extracted = await analyzeWithAI(
      websiteContent || '',
      socialContent,
      {
        agencyId: agency_id,
        clientId: client_id,
        userId: user.id,
        supabase,
      }
    );

    const confidence = calculateConfidence(extracted);

    const result: ScanResult = {
      extracted,
      confidence,
      source_urls: [website, ...social_links.filter((l) => l)],
      cached_at: new Date().toISOString(),
    };

    // Cache result in profile
    await supabase
      .from('client_onboarding_profiles')
      .update({
        ai_scan_result: result,
        ai_scan_at: new Date().toISOString(),
      })
      .eq('client_id', client_id);

    return new Response(
      JSON.stringify(result),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scan error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
});
