/**
 * Converts a hex color string to an rgba color string.
 * @param hex - The hex color string (e.g., #FFFFFF or #FFF)
 * @param opacity - The opacity value (0 to 1)
 * @returns An rgba color string
 */
export const hexToRgba = (hex: string, opacity: number): string => {
    if (!hex) return `rgba(0, 0, 0, ${opacity})`;

    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Calculates the relative luminance of a color.
 * Uses ITU-R BT.709 luma coefficients.
 * @returns Luminance value between 0 and 255
 */
export const getLuminance = (hex: string): number => {
    if (!hex) return 0;
    let c = hex.substring(1);
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const rgb = parseInt(c, 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Determines if a color is perceived as "dark". 
 */
export const isDarkColor = (hex: string): boolean => {
    return getLuminance(hex) < 128; // Standard midpoint
};

/**
 * Ensures a color has sufficient contrast against a background.
 * If contrast is too low, it lightens/darkens the color.
 */
export const ensureContrast = (color: string, background: string, minContrast: number = 40): string => {
    const colorLuma = getLuminance(color);
    const bgLuma = getLuminance(background);
    const diff = Math.abs(colorLuma - bgLuma);

    if (diff >= minContrast) return color;

    // If too dark against background, brighten it
    if (bgLuma < 128) {
        const factor = (bgLuma + minContrast) / Math.max(1, colorLuma);
        return adjustBrightness(color, Math.max(1.2, factor));
    } else {
        // If too light against background, darken it
        const factor = (bgLuma - minContrast) / Math.max(1, colorLuma);
        return adjustBrightness(color, Math.min(0.8, factor));
    }
};

/**
 * Adjusts the brightness of a hex color by a factor.
 */
export const adjustBrightness = (hex: string, factor: number): string => {
    if (!hex) return '#000000';
    let c = hex.substring(1);
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const rgb = parseInt(c, 16);
    let r = Math.min(255, Math.max(0, Math.floor(((rgb >> 16) & 0xff) * factor)));
    let g = Math.min(255, Math.max(0, Math.floor(((rgb >> 8) & 0xff) * factor)));
    let b = Math.min(255, Math.max(0, Math.floor(((rgb >> 0) & 0xff) * factor)));

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

/**
 * Converts HEX to HSL
 */
export const hexToHsl = (hex: string): [number, number, number] => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16) / 255;
        g = parseInt(hex[2] + hex[2], 16) / 255;
        b = parseInt(hex[3] + hex[3], 16) / 255;
    } else {
        r = parseInt(hex.slice(1, 3), 16) / 255;
        g = parseInt(hex.slice(3, 5), 16) / 255;
        b = parseInt(hex.slice(5, 7), 16) / 255;
    }

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s * 100, l * 100];
};

/**
 * Converts HSL to HEX
 */
export const hslToHex = (h: number, s: number, l: number): string => {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = (x: number) => {
        const out = Math.round(x * 255).toString(16);
        return out.length === 1 ? '0' + out : out;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Generates a Material 3 inspired dynamic palette from a seed color.
 * Focuses on dark theme roles with saturation normalization.
 */
export const generateMediaPalette = (seed: string) => {
    // 1. Convert to HSL to check vibrancy
    let [h, s, l] = hexToHsl(seed);

    // 2. Saturation Normalization: If too low (gray/black), boost it to a "Richness Floor"
    // This prevents the whole UI from falling apart into gray.
    if (s < 12) {
        s = 25; // Force a healthy tint
        // If it's truly neutral, give it a sophisticated blue tint
        if (s < 5) h = 210;
    }

    // 3. Normalize Seed for role generation (mid-vibrant baseline)
    const normalizedSeed = hslToHex(h, s, Math.min(60, Math.max(30, l)));
    const luma = getLuminance(normalizedSeed);

    // Base Primary: Boosted for maximum pop (Action Button/Accents)
    const primary = luma < 100 ? adjustBrightness(normalizedSeed, 2.2) : normalizedSeed;

    return {
        primary,
        onPrimary: getLuminance(primary) > 160 ? '#000000' : '#FFFFFF',

        // Tonal Surface: Slightly lifted for better visibility
        surface: adjustBrightness(normalizedSeed, 0.10),

        // Surface Container: slightly lighter for cards/sections
        surfaceContainer: adjustBrightness(normalizedSeed, 0.20),

        // Primary Container: Mid-tone variant
        primaryContainer: adjustBrightness(primary, 0.6),

        // Secondary Container: Lightened for "Bubbles" (Pills)
        secondaryContainer: adjustBrightness(normalizedSeed, 0.45),

        // onSecondaryContainer: Brightened for subtext and icons
        onSecondaryContainer: adjustBrightness(normalizedSeed, 3.5),
    };
};
