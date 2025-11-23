import { useEffect } from "react";

interface UseClientFontsProps {
  primaryFont?: string | null;
  secondaryFont?: string | null;
}

export function useClientFonts({ primaryFont, secondaryFont }: UseClientFontsProps) {
  useEffect(() => {
    // Remove previous client font styles
    const existingStyles = document.querySelectorAll('[data-client-fonts]');
    existingStyles.forEach((style) => style.remove());

    const styleElement = document.createElement('style');
    styleElement.setAttribute('data-client-fonts', 'true');
    
    let cssContent = '';

    // Helper to get actual font family name
    const getFontFamily = (font: string | null | undefined): string | null => {
      if (!font) return null;
      if (font.startsWith('custom:')) return font.replace('custom:', '');
      if (font.startsWith('manual:')) return font.replace('manual:', '');
      return font;
    };

    const primaryFontFamily = getFontFamily(primaryFont);
    const secondaryFontFamily = getFontFamily(secondaryFont);

    // Load Google Fonts
    const loadGoogleFont = (fontFamily: string) => {
      const existingLink = document.querySelector(`link[href*="${fontFamily.replace(/ /g, '+')}"]`);
      if (!existingLink) {
        const link = document.createElement('link');
        link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
    };

    // Load fonts if they're Google Fonts (not custom or manual)
    if (primaryFont && !primaryFont.startsWith('custom:') && !primaryFont.startsWith('manual:')) {
      loadGoogleFont(primaryFont);
    }
    if (secondaryFont && !secondaryFont.startsWith('custom:') && !secondaryFont.startsWith('manual:')) {
      loadGoogleFont(secondaryFont);
    }

    // Apply font CSS
    if (primaryFontFamily) {
      cssContent += `
        .client-workspace h1,
        .client-workspace h2,
        .client-workspace h3,
        .client-workspace h4,
        .client-workspace h5,
        .client-workspace h6 {
          font-family: '${primaryFontFamily}', sans-serif !important;
        }
      `;
    }

    if (secondaryFontFamily) {
      cssContent += `
        .client-workspace,
        .client-workspace p,
        .client-workspace span,
        .client-workspace div,
        .client-workspace label,
        .client-workspace button,
        .client-workspace input,
        .client-workspace textarea {
          font-family: '${secondaryFontFamily}', sans-serif !important;
        }
        
        /* Ensure headings always use primary font */
        .client-workspace h1,
        .client-workspace h2,
        .client-workspace h3,
        .client-workspace h4,
        .client-workspace h5,
        .client-workspace h6 {
          font-family: '${primaryFontFamily || secondaryFontFamily}', sans-serif !important;
        }
      `;
    }

    if (cssContent) {
      styleElement.textContent = cssContent;
      document.head.appendChild(styleElement);
    }

    return () => {
      styleElement.remove();
    };
  }, [primaryFont, secondaryFont]);

  // Return font families for inline use
  return {
    primaryFontFamily: primaryFont ? 
      (primaryFont.startsWith('custom:') || primaryFont.startsWith('manual:') 
        ? primaryFont.replace(/^(custom|manual):/, '') 
        : primaryFont) 
      : undefined,
    secondaryFontFamily: secondaryFont ? 
      (secondaryFont.startsWith('custom:') || secondaryFont.startsWith('manual:') 
        ? secondaryFont.replace(/^(custom|manual):/, '') 
        : secondaryFont) 
      : undefined,
  };
}
