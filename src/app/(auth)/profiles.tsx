import { useAuth } from '@/src/core/AuthContext';
import { useProfiles } from '@/src/core/ProfileContext';
import { useTheme } from '@/src/core/ThemeContext';
import { ExpressiveButton } from '@/src/core/ui/ExpressiveButton';
import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { Typography } from '@/src/core/ui/Typography';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LogOut, User, UserCheck, ExternalLink } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View, Linking } from 'react-native';

const PROFILES_WEB_URL = 'https://crispy-account-management.vercel.app/dashboard';

export default function ProfilesScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const { signOut } = useAuth();
    const {
        loading,
        profiles,
        activeProfileId,
        switchProfile,
    } = useProfiles();

    const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
    const [signingOut, setSigningOut] = useState(false);

    const canInteract = useMemo(() => {
        return !loading && !signingOut && !pendingProfileId;
    }, [loading, pendingProfileId, signingOut]);

    const handleProfilePress = async (profileId: string) => {
        if (!canInteract) return;

        console.log('[ProfilesScreen] Profile pressed:', { profileId, currentActiveId: activeProfileId });
        setPendingProfileId(profileId);
        try {
            await switchProfile(profileId);
            console.log('[ProfilesScreen] Profile switched successfully, navigating to tabs');
            router.replace('/(tabs)');
        } catch (error: any) {
            console.error('[ProfilesScreen] Failed to switch profile:', error);
            Alert.alert('Unable to switch profile', error?.message || 'Please try again.');
        } finally {
            setPendingProfileId(null);
        }
    };

    const handleSignOut = () => {
        Alert.alert(
            'Sign Out',
            'Sign out of this household account?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        setSigningOut(true);
                        try {
                            await signOut();
                            router.replace('/(auth)/login');
                        } catch (error: any) {
                            Alert.alert('Unable to sign out', error?.message || 'Please try again.');
                        } finally {
                            setSigningOut(false);
                        }
                    },
                },
            ]
        );
    };

    return (
        <SettingsSubpage title="Choose Profile">
            <View style={styles.container}>
                <View style={styles.headerCopy}>
                    <Typography variant="title-medium" weight="bold" style={{ color: theme.colors.onSurface }}>
                        Who&apos;s watching?
                    </Typography>
                    <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                        Profiles keep recommendations, Trakt history, and settings separate.
                    </Typography>
                </View>

                <SettingsGroup title="Profiles">
                    {profiles.length > 0 ? (
                        profiles.map((profile) => {
                            const isCurrent = profile.id === activeProfileId;
                            const isSwitching = pendingProfileId === profile.id;

                            return (
                                <Pressable
                                    key={profile.id}
                                    onPress={() => void handleProfilePress(profile.id)}
                                    disabled={!canInteract || isSwitching}
                                    style={({ pressed }) => [
                                        styles.profileRow,
                                        pressed && styles.profileRowPressed,
                                    ]}
                                >
                                    <View
                                        style={[
                                            styles.avatar,
                                            {
                                                backgroundColor: isCurrent
                                                    ? theme.colors.primaryContainer
                                                    : theme.colors.surfaceVariant,
                                            },
                                        ]}
                                    >
                                        {profile.avatar ? (
                                            <Image
                                                source={{ uri: profile.avatar }}
                                                style={styles.avatarImage}
                                                contentFit="cover"
                                                transition={200}
                                            />
                                        ) : isCurrent ? (
                                            <UserCheck size={20} color={theme.colors.onPrimaryContainer} />
                                        ) : (
                                            <User size={20} color={theme.colors.onSurfaceVariant} />
                                        )}
                                    </View>

                                    <View style={styles.profileMeta}>
                                        <Typography variant="title-small" weight="semibold" style={{ color: theme.colors.onSurface }}>
                                            {profile.name}
                                        </Typography>
                                        <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {isCurrent ? 'Current profile' : 'Tap to switch'}
                                        </Typography>
                                    </View>
                                </Pressable>
                            );
                        })
                    ) : (
                        <View style={styles.emptyState}>
                            <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                                No profiles yet.
                            </Typography>
                            <ExpressiveButton
                                title="Create Profile on Web"
                                icon={ExternalLink}
                                variant="primary"
                                onPress={() => Linking.openURL(PROFILES_WEB_URL)}
                                style={{ marginTop: 12 }}
                            />
                        </View>
                    )}
                </SettingsGroup>

                <View style={styles.footerActions}>
                    <ExpressiveButton
                        title="Manage Profiles on Web"
                        icon={ExternalLink}
                        variant="text"
                        onPress={() => Linking.openURL(PROFILES_WEB_URL)}
                        style={{ marginBottom: 12 }}
                    />

                    <ExpressiveButton
                        title="Sign Out"
                        icon={LogOut}
                        variant="outline"
                        onPress={handleSignOut}
                        isLoading={signingOut}
                        disabled={!canInteract}
                    />
                </View>
            </View>
        </SettingsSubpage>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: 8,
        paddingBottom: 24,
    },
    headerCopy: {
        paddingHorizontal: 20,
        marginBottom: 16,
        gap: 4,
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 12,
    },
    profileRowPressed: {
        opacity: 0.85,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    profileMeta: {
        flex: 1,
        gap: 2,
    },
    profileActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    removeButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyState: {
        paddingHorizontal: 20,
        paddingVertical: 20,
        gap: 4,
    },
    createRow: {
        paddingHorizontal: 20,
        gap: 10,
    },
    input: {
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 16,
    },
    createButton: {
        width: '100%',
    },
    footerActions: {
        paddingHorizontal: 20,
        paddingTop: 10,
    },
});
