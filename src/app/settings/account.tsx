import { useRouter } from 'expo-router';
import { CheckCircle2, LogIn, LogOut, RefreshCw } from 'lucide-react-native';
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
    const user = auth?.user;
    const [isLoading, setIsLoading] = useState(false);

    const isSupabaseAuthenticated = !!user;

    const handleLogout = async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            await auth.signOut();
                        } catch (e: any) {
                            Alert.alert('Error', e.message);
                        } finally {
                            setIsLoading(false);
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
                                {isSupabaseAuthenticated ? (user?.user_metadata?.name || 'Crispy User') : 'Guest Account'}
                            </Typography>
                            <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                {isSupabaseAuthenticated
                                    ? (user?.email || 'Signed in via Email')
                                    : 'Sign in to sync your library'}
                            </Typography>
                        </View>
                        <ExpressiveButton
                            title={isSupabaseAuthenticated ? "Logout" : "Sign In"}
                            icon={isSupabaseAuthenticated ? LogOut : LogIn}
                            onPress={isSupabaseAuthenticated ? handleLogout : () => router.push('/(auth)/login')}
                            variant={isSupabaseAuthenticated ? "tonal" : "primary"}
                            isLoading={isLoading}
                        />
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
});
