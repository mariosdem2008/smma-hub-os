interface AgencyBranding {
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  email_sender_name: string | null;
  email_footer: string | null;
  font_primary: string | null;
}

export function generateWhiteLabelEmail(
  branding: AgencyBranding | null,
  subject: string,
  heading: string,
  body: string,
  ctaText?: string,
  ctaUrl?: string
): string {
  const primaryColor = branding?.primary_color || '#6366f1';
  const accentColor = branding?.accent_color || '#8b5cf6';
  const logo = branding?.logo_url || '';
  const senderName = branding?.email_sender_name || 'SMMAHub';
  const footer = branding?.email_footer || '';
  const fontFamily = branding?.font_primary || 'Arial, sans-serif';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body {
          font-family: ${fontFamily};
          margin: 0;
          padding: 0;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
        }
        .header {
          background-color: ${primaryColor};
          padding: 30px 20px;
          text-align: center;
        }
        .header img {
          max-width: 150px;
          height: auto;
        }
        .content {
          padding: 40px 30px;
        }
        .heading {
          font-size: 24px;
          font-weight: bold;
          color: #333;
          margin-bottom: 20px;
        }
        .body-text {
          font-size: 16px;
          line-height: 1.6;
          color: #666;
          margin-bottom: 30px;
        }
        .cta-button {
          display: inline-block;
          padding: 14px 30px;
          background-color: ${accentColor};
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          margin: 20px 0;
        }
        .footer {
          background-color: #f9f9f9;
          padding: 30px;
          text-align: center;
          font-size: 14px;
          color: #999;
        }
        .footer-text {
          margin-bottom: 10px;
        }
        .divider {
          height: 1px;
          background-color: #e5e5e5;
          margin: 30px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        ${logo ? `
          <div class="header">
            <img src="${logo}" alt="${senderName}">
          </div>
        ` : `
          <div class="header">
            <h1 style="color: #ffffff; margin: 0;">${senderName}</h1>
          </div>
        `}
        
        <div class="content">
          <div class="heading">${heading}</div>
          <div class="body-text">${body}</div>
          
          ${ctaText && ctaUrl ? `
            <a href="${ctaUrl}" class="cta-button">${ctaText}</a>
          ` : ''}
        </div>
        
        <div class="footer">
          ${footer ? `
            <div class="footer-text">${footer}</div>
            <div class="divider"></div>
          ` : ''}
          <div class="footer-text">© ${new Date().getFullYear()} ${senderName}. All rights reserved.</div>
          <div class="footer-text" style="color: #ccc; font-size: 12px;">
            This email was sent from your client portal.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
