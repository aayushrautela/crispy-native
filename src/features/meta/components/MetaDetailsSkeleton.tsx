import { Shimmer } from '@/src/core/ui/Shimmer';
import React, { memo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BACKDROP_HEIGHT = 480;

export const MetaDetailsSkeleton = memo(() => {
    return (
        <View style={styles.container}>
            {/* Backdrop Shimmer */}
            <Shimmer height={BACKDROP_HEIGHT} borderRadius={0} />

            <View style={styles.content}>
                {/* Logo/Title Shimmer */}
                <Shimmer width="60%" height={60} style={styles.title} borderRadius={8} />

                {/* Metadata Row Shimmer */}
                <View style={styles.metaRow}>
                    <Shimmer width={80} height={20} />
                    <Shimmer width={60} height={20} />
                    <Shimmer width={100} height={20} />
                </View>

                {/* Description Shimmer */}
                <View style={styles.description}>
                    <Shimmer width="100%" height={16} style={{ marginBottom: 8 }} />
                    <Shimmer width="90%" height={16} style={{ marginBottom: 8 }} />
                    <Shimmer width="40%" height={16} />
                </View>

                {/* Primary Action Button Shimmer */}
                <Shimmer width="100%" height={56} borderRadius={28} style={styles.action} />

                {/* Icon Actions Shimmer */}
                <View style={styles.iconRow}>
                    <Shimmer width={64} height={64} borderRadius={32} />
                    <Shimmer width={64} height={64} borderRadius={32} />
                    <Shimmer width={64} height={64} borderRadius={32} />
                </View>

                {/* Ratings Shimmer */}
                <View style={styles.section}>
                    <Shimmer width={100} height={24} style={{ marginBottom: 16 }} />
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                        <Shimmer width={150} height={80} borderRadius={12} />
                        <Shimmer width={150} height={80} borderRadius={12} />
                    </View>
                </View>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    title: {
        alignSelf: 'center',
        marginBottom: 20,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 24,
    },
    description: {
        marginBottom: 32,
    },
    action: {
        marginBottom: 24,
    },
    iconRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 32,
        marginBottom: 40,
    },
    section: {
        marginTop: 16,
    }
});
