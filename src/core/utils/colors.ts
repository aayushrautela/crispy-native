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
 * Determines if a color is perceived as "dark". Uses ITU-R BT.709 luma coefficients.
 */
export const isDarkColor = (hex: string): boolean => {
    if (!hex) return true;
    let c = hex.substring(1);
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const rgb = parseInt(c, 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;

    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luma < 60;
};

/**
 * Adjusts the brightness of a hex color by a factor.
 */
export const adjustBrightness = (hex: string, factor: number): string => {
    if (!hex) return '#000000';
    let c = hex.substring(1);
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const rgb = parseInt(c, 16);
    let r = Math.min(255, Math.floor(((rgb >> 16) & 0xff) * factor));
    let g = Math.min(255, Math.floor(((rgb >> 8) & 0xff) * factor));
    let b = Math.min(255, Math.floor(((rgb >> 0) & 0xff) * factor));

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};
