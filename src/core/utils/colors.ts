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
