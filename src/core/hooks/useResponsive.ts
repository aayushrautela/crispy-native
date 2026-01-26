
import { useWindowDimensions } from 'react-native';

export const useResponsive = () => {
    const { width, height } = useWindowDimensions();

    const isTablet = width >= 768;
    const isDesktop = width >= 1024;

    // Landscape check usually implies width > height, but for tablet definition we strictly care about available width
    const isLandscape = width > height;

    return {
        width,
        height,
        isTablet,
        isDesktop,
        isLandscape,
        // Common max widths for content
        contentWidth: isTablet ? Math.min(width, 800) : width,
        // Hero section metrics
        heroAspectRatio: isTablet ? (isLandscape ? 2.2 : 1.2) : 0.7,
        heroHeight: Math.min(width / (isTablet ? (isLandscape ? 2.2 : 1.2) : 0.7), height * (isTablet ? 0.55 : 0.8)),
    };
};
