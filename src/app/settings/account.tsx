import { useAuth } from '@/src/core/AuthContext';
import { useProfiles } from '@/src/core/ProfileContext';
import { useTheme } from '@/src/core/ThemeContext';
import { ExpressiveButton } from '@/src/core/ui/ExpressiveButton';
import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { SettingsItem } from '@/src/core/ui/SettingsItem';
import { Typography } from '@/src/core/ui/Typography';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { CheckCircle2, LogOut, RefreshCw, Users, ExternalLink, User } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, StyleSheet, View, Linking } from 'react-native';

const ACCOUNT_WEB_URL = 'https://crispy-account-management.vercel.app/dashboard/account';

export default function AccountScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const auth = useAuth();
    const { profiles, activeProfile } = useProfiles();
    const user = auth.user;
    const [loadingAction, setLoadingAction] = useState<'signout' | null>(null);

    const isAuthenticated = !!user;
    const profileCount = profiles.length;

    const profileTitle = isAuthenticated
        ? (user?.user_metadata?.name || 'Crispy User')
        : 'Not Signed In';

    const profileSubtitle = isAuthenticated
        ? (user?.email || 'Signed in with Supabase')
        : 'Sign in to enable cloud sync';

    const handleLogout = async () => {
        Alert.alert(
            'Sign Out',
            'Sign out of this account on this device?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        setLoadingAction('signout');
                        try {
                            await auth.signOut();
                            router.replace('/(auth)/login');
                        } catch (e: any) {
                            Alert.alert('Error', e.message);
                        } finally {
                            setLoadingAction(null);
                        }
                    }
                }
            ]
        );
    };

    return (
        <SettingsSubpage title="Account">
            <View>
                <SettingsGroup title="Status">
                    <View style={[styles.statusCard, { backgroundColor: theme.colors.surfaceVariant }]}>
                        <View
                            style={[
                                styles.avatar,
                                {
                                    backgroundColor: activeProfile
                                        ? theme.colors.primaryContainer
                                        : theme.colors.surface,
                                },
                            ]}
                        >
                            {activeProfile?.avatar ? (
                                <Image
                                    source={{ uri: activeProfile.avatar }}
                                    style={styles.avatarImage}
                                    contentFit="cover"
                                    transition={200}
                                />
                            ) : (
                                <User
                                    size={20}
                                    color={activeProfile ? theme.colors.onPrimaryContainer : theme.colors.onSurface}
                                />
                            )}
                        </View>
                        <View style={styles.statusInfo}>
                            <Typography variant="title-medium" weight="bold" style={{ color: theme.colors.onSurface }}>
                                {profileTitle}
                            </Typography>
                            <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                {profileSubtitle}
                            </Typography>
                        </View>
                    </View>
                    <SettingsItem
                        icon={Users}
                        label="Profiles"
                        description={activeProfile ? `${profileCount} total, active: ${activeProfile.name}` : `${profileCount} available`}
                        showChevron={false}
                    />
                </SettingsGroup>

                <SettingsGroup title="Actions">
                    <View style={styles.actions}>
                        <ExpressiveButton
                            title="Switch Profile"
                            icon={Users}
                            onPress={() => router.push('/(auth)/profiles' as never)}
                            variant="primary"
                        />

                        <ExpressiveButton
                            title="Sign Out"
                            icon={LogOut}
                            onPress={handleLogout}
                            variant="outline"
                            isLoading={loadingAction === 'signout'}
                        />

                        <ExpressiveButton
                            title="Manage on Web"
                            icon={ExternalLink}
                            onPress={() => Linking.openURL(ACCOUNT_WEB_URL)}
                            variant="text"
                        />
                    </View>
                </SettingsGroup>

                <SettingsGroup title="Features">
                    <SettingsItem
                        icon={RefreshCw}
                        label="Cloud Sync"
                        description="Sync household addons and profile preferences across devices"
                        showChevron={false}
                        rightElement={<CheckCircle2 size={20} color={isAuthenticated ? theme.colors.primary : theme.colors.onSurfaceVariant + '40'} />}
                    />
                </SettingsGroup>
            </View>
        </SettingsSubpage>
    );
}

const styles = StyleSheet.create({
    statusCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        gap: 12,
    },
    statusInfo: {
        flex: 1,
    },
    actions: {
        padding: 20,
        gap: 10,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
});
