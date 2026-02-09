import { useRouter } from 'expo-router';
import { CheckCircle2, LogIn, LogOut, Plus, RefreshCw, Users } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useAuth } from '../../core/AuthContext';
import { useTheme } from '../../core/ThemeContext';
import { ExpressiveButton } from '../../core/ui/ExpressiveButton';
import { SettingsGroup } from '../../core/ui/SettingsGroup';
import { SettingsItem } from '../../core/ui/SettingsItem';
import { Typography } from '../../core/ui/Typography';
import { SettingsSubpage } from '../../core/ui/layout/SettingsSubpage';

export default function AccountScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const auth = useAuth();
    const user = auth.user;
    const [loadingAction, setLoadingAction] = useState<'guest' | 'signout' | null>(null);

    const isSupabaseAuthenticated = auth.mode === 'account' && !!user;
    const profileCount = auth.knownAccounts.length;

    const profileTitle = isSupabaseAuthenticated
        ? (user?.user_metadata?.name || auth.activeAccount?.name || 'Crispy User')
        : (auth.mode === 'guest' ? 'Guest Profile' : 'Not Signed In');

    const profileSubtitle = isSupabaseAuthenticated
        ? (user?.email || auth.activeAccount?.email || 'Signed in with Supabase')
        : (auth.mode === 'guest'
            ? 'Local profile, cloud sync disabled'
            : 'Add an account to enable cloud sync');

    const handleContinueAsGuest = async () => {
        setLoadingAction('guest');
        try {
            await auth.continueAsGuest();
            router.replace('/(tabs)');
        } catch (error: any) {
            Alert.alert('Error', error?.message || 'Unable to switch to guest mode.');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            'Sign Out This Account',
            'This removes the account from this device. You can add it again later.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        setLoadingAction('signout');
                        try {
                            await auth.signOut({ removeAccount: true, fallbackMode: 'anonymous' });
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
                    <View style={styles.statusCard}>
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
                        label="Saved Profiles"
                        description={`${profileCount} available on this device`}
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

                        {isSupabaseAuthenticated ? (
                            <>
                                <ExpressiveButton
                                    title="Continue as Guest"
                                    icon={LogIn}
                                    onPress={handleContinueAsGuest}
                                    variant="tonal"
                                    isLoading={loadingAction === 'guest'}
                                    disabled={loadingAction === 'signout'}
                                />

                                <ExpressiveButton
                                    title="Sign Out & Remove"
                                    icon={LogOut}
                                    onPress={handleLogout}
                                    variant="outline"
                                    isLoading={loadingAction === 'signout'}
                                    disabled={loadingAction === 'guest'}
                                />
                            </>
                        ) : (
                            <ExpressiveButton
                                title="Add Account"
                                icon={Plus}
                                onPress={() => router.push('/(auth)/login?mode=add-account')}
                                variant="tonal"
                                disabled={loadingAction === 'guest'}
                            />
                        )}
                    </View>
                </SettingsGroup>

                <SettingsGroup title="Features">
                    <SettingsItem
                        icon={RefreshCw}
                        label="Cloud Sync"
                        description="Sync addons, catalogs and settings across multiple devices"
                        showChevron={false}
                        rightElement={<CheckCircle2 size={20} color={isSupabaseAuthenticated ? theme.colors.primary : theme.colors.onSurfaceVariant + '40'} />}
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
});
