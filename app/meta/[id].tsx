import { StyleSheet, View, ScrollView, Image, Text, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/src/core/ThemeContext';
import { useMeta } from '@/src/core/hooks/useDiscovery';
import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { ExpressiveButton } from '@/src/cdk/components/ExpressiveButton';
import { ChevronLeft, Play } from 'lucide-react-native';
import { Touchable } from '@/src/cdk/components/Touchable';

export default function MetaDetailsScreen() {
    const { id, type } = useLocalSearchParams();
    const { theme } = useTheme();
    const router = useRouter();

    const { data: meta, isLoading } = useMeta(type as string, id as string);

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>Loading details...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Backdrop */}
            <View style={styles.backdropContainer}>
                {meta?.background && (
                    <Image source={{ uri: meta.background }} style={styles.backdrop} />
                )}
                <View style={[styles.overlay, { backgroundColor: theme.colors.background + '80' }]} />

                <Touchable
                    onPress={() => router.back()}
                    style={[styles.backBtn, { backgroundColor: theme.colors.surface + '80' }]}
                >
                    <ChevronLeft color={theme.colors.onSurface} size={24} />
                </Touchable>
            </View>

            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={styles.posterContainer}>
                        <ExpressiveSurface variant="elevated" rounding="xl" style={styles.posterSurface}>
                            <Image source={{ uri: meta?.poster }} style={styles.poster} />
                        </ExpressiveSurface>
                    </View>
                    <View style={styles.headerText}>
                        <Text style={[styles.title, { color: theme.colors.onSurface }]}>{meta?.name}</Text>
                        <Text style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>
                            {meta?.releaseInfo} • {meta?.runtime}
                        </Text>
                        <ExpressiveButton
                            title="Watch Now"
                            variant="primary"
                            icon={<Play size={20} color={theme.colors.onPrimary} />}
                            onPress={() => { }}
                            style={styles.playBtn}
                        />
                    </View>
                </View>

                <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Storyline</Text>
                <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
                    {meta?.description}
                </Text>

                {/* Stream section would go here in Phase 3 */}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backdropContainer: {
        height: 300,
        width: '100%',
        position: 'relative',
    },
    backdrop: {
        width: '100%',
        height: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    backBtn: {
        position: 'absolute',
        top: 54,
        left: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        marginTop: -60,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 24,
    },
    posterContainer: {
        width: 120,
        height: 180,
    },
    posterSurface: {
        flex: 1,
        overflow: 'hidden',
    },
    poster: {
        width: '100%',
        height: '100%',
    },
    headerText: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingBottom: 4,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        lineHeight: 32,
        marginBottom: 4,
    },
    meta: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 16,
    },
    playBtn: {
        alignSelf: 'flex-start',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    description: {
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 32,
    }
});
