import { useResponsive } from '@/src/core/hooks/useResponsive';
import { Shimmer } from '@/src/core/ui/Shimmer';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';

const BACKDROP_HEIGHT = 420;
const HERO_HEIGHT = 600;

export const MetaDetailsSkeleton = memo(() => {
    const { isTablet, isLandscape, width } = useResponsive();
    const isSplitLayout = isTablet && isLandscape;

    if (isSplitLayout) {
        return (
            <View style={styles.container}>
                <View style={styles.splitHero}>
                    <View style={styles.leftPane}>
                        <Shimmer height="100%" width="100%" borderRadius={0} />
                        <View style={styles.leftPaneOverlay}>
                            <Shimmer width={100} height={36} borderRadius={20} />
                            <Shimmer width={400} height={120} borderRadius={12} />
                        </View>
                    </View>
                    <View style={styles.rightPane}>
                        <View style={styles.rightContent}>
                            <Shimmer width="80%" height={48} borderRadius={8} />
                            <View style={styles.metaRow}>
                                <Shimmer width={60} height={18} />
                                <Shimmer width={40} height={18} />
                                <Shimmer width={80} height={18} />
                            </View>
                            <View style={styles.description}>
                                <Shimmer width="100%" height={16} style={{ marginBottom: 8 }} />
                                <Shimmer width="90%" height={16} style={{ marginBottom: 8 }} />
                                <Shimmer width="40%" height={16} />
                            </View>
                            <Shimmer width="100%" height={68} borderRadius={34} />
                            <View style={[styles.iconRow, { marginTop: 24 }]}>
                                {[1, 2, 3, 4].map(i => (
                                    <Shimmer key={i} width={56} height={56} borderRadius={28} />
                                ))}
                            </View>
                        </View>
                    </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.bodyScroll}>
                    <View style={styles.body}>
                        {/* Ratings Section Shimmer */}
                        <View style={styles.section}>
                            <Shimmer width={100} height={24} style={styles.sectionTitle} />
                            <View style={[styles.horizontalScroll, { flexWrap: 'wrap', flexDirection: 'row' }]}>
                                {[1, 2, 3, 4].map(i => (
                                    <Shimmer key={i} width={160} height={64} borderRadius={32} />
                                ))}
                            </View>
                        </View>

                        <View style={styles.gridContainer}>
                            {/* Cast Section Shimmer */}
                            <View style={[styles.section, { flex: 1 }]}>
                                <Shimmer width={80} height={24} style={styles.sectionTitle} />
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                                    {[1, 2, 3, 4, 5, 6].map(i => (
                                        <View key={i} style={{ alignItems: 'center', width: 100 }}>
                                            <Shimmer width={80} height={80} borderRadius={40} />
                                            <Shimmer width={70} height={12} style={{ marginTop: 12 }} />
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Reviews Section Shimmer */}
                            <View style={[styles.section, { flex: 1 }]}>
                                <Shimmer width={120} height={24} style={styles.sectionTitle} />
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                                    {[1, 2].map(i => (
                                        <Shimmer key={i} width={280} height={160} borderRadius={24} />
                                    ))}
                                </ScrollView>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Static Backdrop Skeleton */}
            <View style={styles.staticBackdrop}>
                <Shimmer height={BACKDROP_HEIGHT} borderRadius={0} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {/* Hero Content Area */}
                <View style={{ minHeight: HERO_HEIGHT, paddingTop: 350 }}>
                    {/* Fade Overlay Simulation */}
                    <LinearGradient
                        colors={['rgba(18,18,18,0)', 'rgba(18,18,18,1)', 'rgba(18,18,18,1)']}
                        locations={[0, 0.4, 1]}
                        style={styles.fadeOverlay}
                    />

                    <View style={styles.heroContent}>
                        {/* Trailer Button Shimmer */}
                        <Shimmer width={100} height={36} borderRadius={20} />

                        {/* Logo/Title Shimmer */}
                        <Shimmer width="70%" height={80} borderRadius={12} />

                        {/* Metadata Row Shimmer */}
                        <View style={styles.metaRow}>
                            <Shimmer width={60} height={18} />
                            <Shimmer width={40} height={18} />
                            <Shimmer width={80} height={18} />
                        </View>

                        {/* Description Shimmer */}
                        <View style={styles.description}>
                            <Shimmer width="100%" height={16} style={{ marginBottom: 8 }} />
                            <Shimmer width="90%" height={16} style={{ marginBottom: 8 }} />
                            <Shimmer width="40%" height={16} />
                        </View>

                        {/* Primary Action Button Shimmer */}
                        <Shimmer width="100%" height={68} borderRadius={34} />
                    </View>
                </View>

                {/* Body Content */}
                <View style={styles.body}>
                    {/* Icon Actions Shimmer (MetaActionRow) */}
                    <View style={styles.iconRow}>
                        {[1, 2, 3, 4].map(i => (
                            <Shimmer key={i} width={64} height={64} borderRadius={32} />
                        ))}
                    </View>

                    {/* Ratings Section Shimmer */}
                    <View style={styles.section}>
                        <Shimmer width={100} height={24} style={styles.sectionTitle} />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                            {[1, 2, 3].map(i => (
                                <Shimmer key={i} width={160} height={64} borderRadius={32} />
                            ))}
                        </ScrollView>
                    </View>

                    {/* Cast Section Shimmer */}
                    <View style={styles.section}>
                        <Shimmer width={80} height={24} style={styles.sectionTitle} />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                            {[1, 2, 3, 4, 5].map(i => (
                                <View key={i} style={{ alignItems: 'center', width: 100 }}>
                                    <Shimmer width={80} height={80} borderRadius={40} />
                                    <Shimmer width={70} height={12} style={{ marginTop: 12 }} />
                                    <Shimmer width={50} height={10} style={{ marginTop: 4 }} />
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Reviews/Comments Section Shimmer */}
                    <View style={styles.section}>
                        <Shimmer width={120} height={24} style={styles.sectionTitle} />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                            {[1, 2].map(i => (
                                <Shimmer key={i} width={280} height={160} borderRadius={24} />
                            ))}
                        </ScrollView>
                    </View>

                    {/* Episodes/Recommendations Section Shimmer */}
                    <View style={styles.section}>
                        <Shimmer width={150} height={24} style={styles.sectionTitle} />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                            {[1, 2].map(i => (
                                <Shimmer key={i} width={280} height={200} borderRadius={16} />
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    staticBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: BACKDROP_HEIGHT,
        zIndex: 0,
    },
    fadeOverlay: {
        position: 'absolute',
        top: BACKDROP_HEIGHT - 150,
        left: 0,
        right: 0,
        bottom: 0,
    },
    heroContent: {
        alignItems: 'center',
        paddingHorizontal: 20,
        gap: 16,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    description: {
        width: '100%',
        alignItems: 'center',
        marginVertical: 8,
    },
    body: {
        paddingHorizontal: 20,
        marginTop: 24,
    },
    iconRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        marginBottom: 32,
    },
    section: {
        marginTop: 32,
        marginHorizontal: -20,
    },
    sectionTitle: {
        marginLeft: 20,
        marginBottom: 16,
    },
    horizontalScroll: {
        gap: 16,
        paddingHorizontal: 20,
    },
    // Split Layout Styles
    splitHero: {
        flexDirection: 'row',
        height: 600,
    },
    leftPane: {
        width: '60%',
        height: '100%',
    },
    leftPaneOverlay: {
        position: 'absolute',
        bottom: 48,
        left: 0,
        right: 0,
        alignItems: 'center',
        gap: 12,
    },
    rightPane: {
        width: '40%',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    rightContent: {
        gap: 16,
        alignItems: 'center',
    },
    bodyScroll: {
        paddingBottom: 100,
    },
    gridContainer: {
        flexDirection: 'row',
        gap: 24,
    }
});
