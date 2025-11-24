import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { clientId } = await req.json();

    // Fetch all branding data
    const { data: client, error: clientError } = await supabaseClient
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError) throw clientError;

    const { data: branding } = await supabaseClient
      .from('client_branding')
      .select('*')
      .eq('client_id', clientId)
      .single();

    const { data: hashtags } = await supabaseClient
      .from('client_hashtags')
      .select('*')
      .eq('client_id', clientId);

    const { data: pillars } = await supabaseClient
      .from('client_content_pillars')
      .select('*')
      .eq('client_id', clientId);

    const { data: assets } = await supabaseClient
      .from('assets')
      .select('*')
      .eq('client_id', clientId)
      .limit(6);

    // Generate HTML for PDF
    const html = generateBrandGuidelinesHTML({
      client,
      branding,
      hashtags: hashtags || [],
      pillars: pillars || [],
      assets: assets || [],
    });

    // Convert HTML to PDF using a simple approach
    const pdfBytes = await generatePDF(html);

    // Upload to storage
    const fileName = `brand-guidelines-${client.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabaseClient
      .storage
      .from('client-assets')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabaseClient
      .storage
      .from('client-assets')
      .getPublicUrl(fileName);

    // Save reference in client_assets table
    await supabaseClient
      .from('client_assets')
      .insert({
        client_id: clientId,
        file_url: publicUrl,
        file_name: fileName,
        file_type: 'application/pdf',
        uploaded_by: user.id,
      });

    return new Response(
      JSON.stringify({ success: true, url: publicUrl, fileName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating brand guidelines PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateBrandGuidelinesHTML(data: any): string {
  const { client, branding, hashtags, pillars, assets } = data;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      padding: 60px;
      background: white;
      color: #1a1a1a;
    }
    h1 { 
      font-size: 48px; 
      margin-bottom: 40px;
      color: ${branding?.primary_color || '#000'};
    }
    h2 { 
      font-size: 32px; 
      margin: 40px 0 20px;
      color: ${branding?.primary_color || '#000'};
      border-bottom: 3px solid ${branding?.primary_color || '#000'};
      padding-bottom: 10px;
    }
    h3 { font-size: 24px; margin: 20px 0 10px; }
    .section { margin-bottom: 50px; page-break-inside: avoid; }
    .color-palette { display: flex; gap: 20px; flex-wrap: wrap; }
    .color-box { 
      width: 120px; 
      height: 120px; 
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      display: flex;
      align-items: flex-end;
      padding: 10px;
    }
    .color-label {
      background: white;
      padding: 5px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .logo-section {
      background: #f5f5f5;
      padding: 40px;
      border-radius: 12px;
      text-align: center;
      margin: 20px 0;
    }
    .logo-img {
      max-width: 300px;
      max-height: 200px;
    }
    .font-preview {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 8px;
      margin: 15px 0;
    }
    .hashtag-group {
      display: inline-block;
      background: #f0f0f0;
      padding: 8px 16px;
      border-radius: 20px;
      margin: 5px;
      font-size: 14px;
    }
    .pillar-card {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 8px;
      margin: 15px 0;
      border-left: 4px solid ${branding?.primary_color || '#000'};
    }
    .assets-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 20px;
    }
    .asset-thumb {
      aspect-ratio: 1;
      border-radius: 8px;
      background: #f0f0f0;
      overflow: hidden;
    }
    .cover-page {
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      page-break-after: always;
    }
    .cover-title {
      font-size: 72px;
      font-weight: bold;
      margin-bottom: 20px;
    }
    .cover-subtitle {
      font-size: 32px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="cover-page">
    <h1 class="cover-title">${client.name}</h1>
    <p class="cover-subtitle">Brand Guidelines</p>
  </div>

  ${client.logo_url ? `
  <div class="section">
    <h2>Logo</h2>
    <div class="logo-section">
      <img src="${client.logo_url}" alt="Logo" class="logo-img" />
    </div>
  </div>
  ` : ''}

  <div class="section">
    <h2>Color Palette</h2>
    <div class="color-palette">
      ${branding?.primary_color ? `
        <div class="color-box" style="background: ${branding.primary_color}">
          <span class="color-label">${branding.primary_color}</span>
        </div>
      ` : ''}
      ${branding?.secondary_color ? `
        <div class="color-box" style="background: ${branding.secondary_color}">
          <span class="color-label">${branding.secondary_color}</span>
        </div>
      ` : ''}
      ${branding?.accent_color ? `
        <div class="color-box" style="background: ${branding.accent_color}">
          <span class="color-label">${branding.accent_color}</span>
        </div>
      ` : ''}
      ${branding?.brand_palette?.map((color: string) => `
        <div class="color-box" style="background: ${color}">
          <span class="color-label">${color}</span>
        </div>
      `).join('') || ''}
    </div>
  </div>

  <div class="section">
    <h2>Typography</h2>
    ${client.primary_font ? `
      <div class="font-preview">
        <h3>Primary Font</h3>
        <p style="font-family: '${client.primary_font}', sans-serif; font-size: 24px; margin-top: 10px;">
          ${client.primary_font}
        </p>
        <p style="font-family: '${client.primary_font}', sans-serif; font-size: 18px; margin-top: 10px;">
          The quick brown fox jumps over the lazy dog
        </p>
      </div>
    ` : ''}
    ${client.secondary_font ? `
      <div class="font-preview">
        <h3>Secondary Font</h3>
        <p style="font-family: '${client.secondary_font}', sans-serif; font-size: 24px; margin-top: 10px;">
          ${client.secondary_font}
        </p>
        <p style="font-family: '${client.secondary_font}', sans-serif; font-size: 18px; margin-top: 10px;">
          The quick brown fox jumps over the lazy dog
        </p>
      </div>
    ` : ''}
  </div>

  ${branding?.brand_voice || branding?.brand_tone ? `
  <div class="section">
    <h2>Brand Voice & Tone</h2>
    ${branding.brand_voice ? `
      <div class="font-preview">
        <h3>Brand Voice</h3>
        <p>${branding.brand_voice}</p>
      </div>
    ` : ''}
    ${branding.brand_tone ? `
      <div class="font-preview">
        <h3>Brand Tone</h3>
        <p>${branding.brand_tone}</p>
      </div>
    ` : ''}
  </div>
  ` : ''}

  ${hashtags.length > 0 ? `
  <div class="section">
    <h2>Hashtag Groups</h2>
    ${hashtags.map((h: any) => `
      <span class="hashtag-group">${h.tag}</span>
    `).join('')}
  </div>
  ` : ''}

  ${pillars.length > 0 ? `
  <div class="section">
    <h2>Content Pillars</h2>
    ${pillars.map((p: any) => `
      <div class="pillar-card">
        <h3>${p.title}</h3>
        ${p.description ? `<p style="margin-top: 10px; color: #666;">${p.description}</p>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${branding?.brand_guidelines ? `
  <div class="section">
    <h2>Brand Guidelines</h2>
    <div class="font-preview">
      ${branding.brand_guidelines}
    </div>
  </div>
  ` : ''}

  ${assets.length > 0 ? `
  <div class="section">
    <h2>Visual Assets</h2>
    <div class="assets-grid">
      ${assets.map((a: any) => `
        <div class="asset-thumb" style="background-image: url('${a.file_url}'); background-size: cover; background-position: center;"></div>
      `).join('')}
    </div>
  </div>
  ` : ''}
</body>
</html>
  `;
}

async function generatePDF(html: string): Promise<Uint8Array> {
  // Use Puppeteer for PDF generation in Deno
  const response = await fetch('https://pdf.lovable.app/api/render', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
    },
    body: JSON.stringify({
      html,
      options: {
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate PDF');
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
