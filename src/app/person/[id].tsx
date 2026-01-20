import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { LoadingIndicator } from '@/src/cdk/components/LoadingIndicator';
import { Typography } from '@/src/cdk/components/Typography';
import { TMDBPerson, TMDBService } from '@/src/core/api/TMDBService';
import { useTheme } from '@/src/core/ThemeContext';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown, ChevronUp, Instagram, Twitter } from 'lucide-react-native';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { Dimensions, Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CatalogRow } from '../../components/CatalogRow';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 450;

export default function PersonDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { theme } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [person, setPerson] = useState<TMDBPerson | null>(null);
    const [loading, setLoading] = useState(true);
    const [bioExpanded, setBioExpanded] = useState(false);

    const scrollY = useSharedValue(0);

    const onScroll = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const backdropStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateY: interpolate(scrollY.value, [0, HERO_HEIGHT], [0, -HERO_HEIGHT * 0.4], Extrapolation.CLAMP) },
                { scale: interpolate(scrollY.value, [-100, 0], [1.2, 1], Extrapolation.CLAMP) }
            ],
        };
    });

    useEffect(() => {
        if (id) {
            setLoading(true);
            TMDBService.getPersonDetails(Number(id)).then(data => {
                setPerson(data);
                setLoading(false);
            });
        }
    }, [id]);

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <LoadingIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    if (!person) {
        return (
            <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>Person not found.</Typography>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Parallax Backdrop */}
            <Animated.View style={[styles.parallaxLayer, backdropStyle]} pointerEvents="none">
                <ExpoImage source={{ uri: person.profile || '' }} style={styles.heroImage} contentFit="cover" />
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.3)', theme.colors.background]}
                    locations={[0, 0.5, 1]}
                    style={styles.heroGradient}
                />
            </Animated.View>

            {/* Floating Back Button */}
            <View style={[styles.backButtonOverlay, { top: insets.top + 8 }]}>
                <Pressable
                    onPress={() => router.back()}
                    style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                >
                    <ArrowLeft color="white" size={24} />
                </Pressable>
            </View>

            <Animated.ScrollView
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                style={{ zIndex: 1 }}
            >
                {/* Hero Title Area */}
                <View style={{ height: HERO_HEIGHT, justifyContent: 'flex-end', paddingBottom: 24, paddingHorizontal: 20 }}>
                    <Typography variant="display-large" weight="black" rounded style={{ color: 'white', fontSize: 42, lineHeight: 48 }}>
                        {person.name}
                    </Typography>
                    <Typography variant="headline-small" weight="medium" style={{ color: 'white', opacity: 0.8, marginTop: 4 }}>
                        {person.known_for_department}
                    </Typography>
                </View>

                {/* Gradient Fade for Body Start */}
                <LinearGradient
                    colors={['transparent', theme.colors.background]}
                    style={{ height: 100, marginTop: -100 }}
                    pointerEvents="none"
                />

                {/* Body Content */}
                <View style={[styles.body, { backgroundColor: theme.colors.background }]}>

                    {/* Bio Section */}
                    {person.biography ? (
                        <View style={styles.section}>
                            <Typography variant="headline-medium" weight="black" style={{ color: theme.colors.onSurface, marginBottom: 12 }}>Biography</Typography>
                            <Typography
                                variant="body-large"
                                style={{ color: theme.colors.onSurface, opacity: 0.8, lineHeight: 24 }}
                                numberOfLines={bioExpanded ? undefined : 6}
                            >
                                {person.biography}
                            </Typography>
                            <Pressable
                                onPress={() => setBioExpanded(!bioExpanded)}
                                style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 }}
                            >
                                <Typography variant="label-large" weight="bold" style={{ color: theme.colors.primary }}>
                                    {bioExpanded ? 'Show Less' : 'Read More'}
                                </Typography>
                                {bioExpanded ? <ChevronUp size={16} color={theme.colors.primary} /> : <ChevronDown size={16} color={theme.colors.primary} />}
                            </Pressable>
                        </View>
                    ) : null}

                    {/* Metadata: Born */}
                    {person.birthday && (
                        <View style={styles.section}>
                            <Typography variant="label-small" weight="black" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.5, marginBottom: 4 }}>BORN</Typography>
                            <Typography variant="body-medium" weight="bold" style={{ color: theme.colors.onSurface }}>
                                {new Date(person.birthday).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                            </Typography>
                        </View>
                    )}

                    {/* Metadata: From */}
                    {person.place_of_birth && (
                        <View style={styles.section}>
                            <Typography variant="label-small" weight="black" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.5, marginBottom: 4 }}>FROM</Typography>
                            <Typography variant="body-medium" weight="bold" style={{ color: theme.colors.onSurface }}>
                                {person.place_of_birth}
                            </Typography>
                        </View>
                    )}

                    {/* Social Links */}
                    {(person.external_ids.imdb_id || person.external_ids.instagram_id || person.external_ids.twitter_id) && (
                        <View style={styles.section}>
                            <Typography variant="label-small" weight="black" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.5, marginBottom: 8 }}>SOCIALS</Typography>
                            <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                                {person.external_ids.imdb_id && (
                                    <ExpressiveSurface
                                        onPress={() => Linking.openURL(`https://www.imdb.com/name/${person.external_ids.imdb_id}`)}
                                        variant="outlined"
                                        rounding="full"
                                        style={styles.socialIconBtn}
                                    >
                                        <View style={{ backgroundColor: '#F5C518', paddingHorizontal: 2, borderRadius: 2 }}>
                                            <Typography variant="label-small" weight="black" style={{ color: '#000', fontSize: 10 }}>IMDb</Typography>
                                        </View>
                                    </ExpressiveSurface>
                                )}
                                {person.external_ids.instagram_id && (
                                    <ExpressiveSurface
                                        onPress={() => Linking.openURL(`https://www.instagram.com/${person.external_ids.instagram_id}`)}
                                        variant="outlined"
                                        rounding="full"
                                        style={styles.socialIconBtn}
                                    >
                                        <Instagram size={20} color={theme.colors.onSurface} />
                                    </ExpressiveSurface>
                                )}
                                {person.external_ids.twitter_id && (
                                    <ExpressiveSurface
                                        onPress={() => Linking.openURL(`https://twitter.com/${person.external_ids.twitter_id}`)}
                                        variant="outlined"
                                        rounding="full"
                                        style={styles.socialIconBtn}
                                    >
                                        <Twitter size={20} color={theme.colors.onSurface} strokeWidth={2.5} />
                                    </ExpressiveSurface>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Filmography Section */}
                    {person.credits.cast && person.credits.cast.length > 0 && (
                        <View style={[styles.section, { marginHorizontal: -20 }]}>
                            <CatalogRow
                                title="Known For"
                                items={person.credits.cast.slice(0, 20)}
                            />
                        </View>
                    )}

                </View>
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backButtonOverlay: {
        position: 'absolute',
        left: 16,
        zIndex: 1000,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    parallaxLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: HERO_HEIGHT,
        width: SCREEN_WIDTH,
        zIndex: 0,
    },
    heroImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    heroGradient: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    body: {
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    section: {
        marginBottom: 24,
    },
    socialIconBtn: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    }
});
