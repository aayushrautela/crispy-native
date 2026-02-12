import { useAuth } from '@/src/core/AuthContext';
import { useProfiles } from '@/src/core/ProfileContext';
import { useTheme } from '@/src/core/ThemeContext';
import { ExpressiveButton } from '@/src/core/ui/ExpressiveButton';
import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { Typography } from '@/src/core/ui/Typography';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { useRouter } from 'expo-router';
import { LogOut, Plus, User, UserCheck, UserMinus } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

export default function ProfilesScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const { signOut } = useAuth();
    const {
        loading,
        profiles,
        activeProfileId,
        switchProfile,
        createProfile,
        deleteProfile,
    } = useProfiles();

    const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
    const [removeLoadingId, setRemoveLoadingId] = useState<string | null>(null);
    const [newProfileName, setNewProfileName] = useState('');
    const [creating, setCreating] = useState(false);
    const [signingOut, setSigningOut] = useState(false);

    const canInteract = useMemo(() => {
        return !loading && !creating && !signingOut && !pendingProfileId && !removeLoadingId;
    }, [creating, loading, pendingProfileId, removeLoadingId, signingOut]);

    const handleProfilePress = async (profileId: string) => {
        if (!canInteract) return;

        setPendingProfileId(profileId);
        try {
            await switchProfile(profileId);
            router.replace('/(tabs)');
        } catch (error: any) {
            Alert.alert('Unable to switch profile', error?.message || 'Please try again.');
        } finally {
            setPendingProfileId(null);
        }
    };

    const handleCreateProfile = async () => {
        if (!canInteract) return;

        const trimmed = newProfileName.trim();
        if (!trimmed) {
            Alert.alert('Profile name required', 'Please enter a profile name.');
            return;
        }

        setCreating(true);
        try {
            const profile = await createProfile(trimmed);
            setNewProfileName('');
            await switchProfile(profile.id);
            router.replace('/(tabs)');
        } catch (error: any) {
            Alert.alert('Unable to create profile', error?.message || 'Please try again.');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteProfile = (profileId: string, label: string) => {
        if (!canInteract) return;
        if (profiles.length <= 1) {
            Alert.alert('Cannot delete profile', 'Create another profile before deleting this one.');
            return;
        }

        Alert.alert(
            'Delete Profile',
            `Delete ${label}? This removes local profile data on this device.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setRemoveLoadingId(profileId);
                        try {
                            await deleteProfile(profileId);
                        } catch (error: any) {
                            Alert.alert('Unable to delete profile', error?.message || 'Please try again.');
                        } finally {
                            setRemoveLoadingId(null);
                        }
                    },
                },
            ]
        );
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
                            const isRemoving = removeLoadingId === profile.id;

                            return (
                                <Pressable
                                    key={profile.id}
                                    onPress={() => void handleProfilePress(profile.id)}
                                    disabled={!canInteract || isSwitching || isRemoving}
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
                                        {isCurrent ? (
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

                                    <View style={styles.profileActions}>
                                        <Pressable
                                            onPress={(event) => {
                                                event.stopPropagation();
                                                handleDeleteProfile(profile.id, profile.name);
                                            }}
                                            disabled={isRemoving || !canInteract}
                                            style={({ pressed }) => [
                                                styles.removeButton,
                                                {
                                                    backgroundColor: theme.colors.errorContainer,
                                                    opacity: pressed ? 0.8 : 1,
                                                },
                                            ]}
                                        >
                                            <UserMinus size={16} color={theme.colors.onErrorContainer} />
                                        </Pressable>
                                    </View>
                                </Pressable>
                            );
                        })
                    ) : (
                        <View style={styles.emptyState}>
                            <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant }}>
                                No profiles yet.
                            </Typography>
                            <Typography variant="body-small" style={{ color: theme.colors.outline }}>
                                Create your first profile to continue.
                            </Typography>
                        </View>
                    )}
                </SettingsGroup>

                <SettingsGroup title="Create Profile">
                    <View style={styles.createRow}>
                        <TextInput
                            value={newProfileName}
                            onChangeText={setNewProfileName}
                            placeholder="Profile name"
                            placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                            style={[
                                styles.input,
                                {
                                    backgroundColor: theme.colors.elevation.level2,
                                    color: theme.colors.onSurface,
                                    borderColor: theme.colors.outlineVariant,
                                },
                            ]}
                        />
                        <ExpressiveButton
                            title="Add"
                            icon={Plus}
                            onPress={handleCreateProfile}
                            isLoading={creating}
                            disabled={!canInteract}
                            style={styles.createButton}
                        />
                    </View>
                </SettingsGroup>

                <View style={styles.footerActions}>
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
