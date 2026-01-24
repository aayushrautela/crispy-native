import { useRouter } from 'expo-router';
import { LogIn, User, UserCircle } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../core/AuthContext';
import { useTheme } from '../../core/ThemeContext';
import { SettingsGroup } from '../../core/ui/SettingsGroup';
import { SettingsItem } from '../../core/ui/SettingsItem';
import { Typography } from '../../core/ui/Typography';
import { SettingsSubpage } from '../../core/ui/layout/SettingsSubpage';
import { useUserStore } from '../../features/trakt/stores/userStore';

export default function AccountScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const auth = useAuth();
    const user = auth?.user;
    const traktAuth = useUserStore(s => s.traktAuth);

    const isTraktAuthenticated = !!traktAuth?.accessToken;
    const isSupabaseAuthenticated = !!user;

    return (
        <SettingsSubpage title="Account">
            <View>
                <View style={styles.profileHeader}>
                    <View style={[styles.avatarContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                        <UserCircle size={48} color={theme.colors.primary} />
                    </View>
                    <View style={styles.profileInfo}>
                        <Typography variant="title-large" weight="bold" style={{ color: theme.colors.onSurface }}>
                            {user?.user_metadata?.name || user?.email || 'Guest User'}
                        </Typography>
                        <Typography variant="body-medium" style={{ color: theme.colors.onSurfaceVariant }}>
                            {isSupabaseAuthenticated ? 'Cloud Sync Active' : 'Sign in to sync your library'}
                        </Typography>
                    </View>
                </View>

                <SettingsGroup title="Integrations">
                    <SettingsItem
                        icon={User}
                        label="Trakt.tv"
                        description={isTraktAuthenticated ? "Account synced & active" : "Sync watch history across devices"}
                        onPress={() => router.push('/settings/trakt')}
                    />
                </SettingsGroup>

                {!isSupabaseAuthenticated && (
                    <SettingsGroup title="Cloud Sync">
                        <SettingsItem
                            icon={LogIn}
                            label="Sign In"
                            description="Access your profile and favorites"
                            onPress={() => router.replace('/(auth)/login')}
                        />
                    </SettingsGroup>
                )}
            </View>
        </SettingsSubpage>
    );
}

const styles = StyleSheet.create({
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 24,
        gap: 20,
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileInfo: {
        flex: 1,
    }
});
