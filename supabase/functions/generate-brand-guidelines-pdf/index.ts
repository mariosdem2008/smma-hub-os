import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const FN_VERSION = "generate-brand-guidelines-pdf_2026-03-06_1";

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function buildSimplePdf(lines: string[]): Uint8Array {
  const sanitizedLines = lines.map((line) => escapePdfText(line).slice(0, 180));
  const textOps: string[] = ["BT", "/F1 12 Tf", "50 780 Td"];
  for (let index = 0; index < sanitizedLines.length; index += 1) {
    if (index > 0) textOps.push("0 -18 Td");
    textOps.push(`(${sanitizedLines[index]}) Tj`);
  }
  textOps.push("ET");
  const streamContent = `${textOps.join("\n")}\n`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

function jsonResponse(req: Request, status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(req, 500, {
      success: false,
      code: "E00_ENV",
      error: "Missing Supabase env configuration",
      v: FN_VERSION,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return jsonResponse(req, 401, {
        success: false,
        code: "E01_AUTH",
        error: "Unauthorized",
        v: FN_VERSION,
      });
    }

    const accessToken = authHeader.replace(/bearer\s+/i, "");
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(accessToken);

    if (userError || !user) {
      return jsonResponse(req, 401, {
        success: false,
        code: "E01_AUTH",
        error: "Unauthorized",
        v: FN_VERSION,
      });
    }

    const body = await req.json().catch(() => ({}));
    const clientId = String(body?.clientId ?? "").trim();
    if (!clientId) {
      return jsonResponse(req, 400, {
        success: false,
        code: "E400_CLIENT_ID",
        error: "clientId is required",
        v: FN_VERSION,
      });
    }

    const { data: client, error: clientError } = await supabaseService
      .from("clients")
      .select("id, name, website, niche, agency_id")
      .eq("id", clientId)
      .maybeSingle();
    if (clientError || !client) {
      return jsonResponse(req, 404, {
        success: false,
        code: "E404_CLIENT",
        error: "Client not found",
        v: FN_VERSION,
      });
    }

    const { data: membership, error: membershipError } = await supabaseService
      .from("agency_members")
      .select("id")
      .eq("agency_id", client.agency_id)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (membershipError || !membership) {
      return jsonResponse(req, 403, {
        success: false,
        code: "E403_ROLE",
        error: "Forbidden",
        v: FN_VERSION,
      });
    }

    const { data: branding } = await supabaseService
      .from("client_branding")
      .select("primary_color, secondary_color, accent_color, brand_voice, brand_tone, brand_guidelines")
      .eq("client_id", clientId)
      .maybeSingle();

    const lines = [
      "SMMAHUB Brand Guidelines",
      `Client: ${client.name ?? "Unknown"}`,
      `Website: ${client.website ?? "-"}`,
      `Niche: ${client.niche ?? "-"}`,
      `Primary Color: ${branding?.primary_color ?? "-"}`,
      `Secondary Color: ${branding?.secondary_color ?? "-"}`,
      `Accent Color: ${branding?.accent_color ?? "-"}`,
      "",
      "Brand Voice:",
      branding?.brand_voice ?? "-",
      "",
      "Brand Tone:",
      branding?.brand_tone ?? "-",
      "",
      "Guidelines:",
      branding?.brand_guidelines ?? "-",
      "",
      `Generated at: ${new Date().toISOString()}`,
    ];

    const pdfBytes = buildSimplePdf(lines);
    const base64 = toBase64(pdfBytes);
    const fileName = `${(client.name ?? "brand-guidelines").replace(/\s+/g, "-").toLowerCase()}-brand-guidelines.pdf`;

    return jsonResponse(req, 200, {
      success: true,
      url: `data:application/pdf;base64,${base64}`,
      file_name: fileName,
      v: FN_VERSION,
    });
  } catch (error) {
    return jsonResponse(req, 500, {
      success: false,
      code: "E99_UNKNOWN",
      error: error instanceof Error ? error.message : "Unknown error",
      v: FN_VERSION,
    });
  }
});
