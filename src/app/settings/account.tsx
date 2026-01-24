import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { SettingsItem } from '@/src/core/ui/SettingsItem';
import { Typography } from '@/src/core/ui/Typography';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { useRouter } from 'expo-router';
import { LogIn, User, UserCircle } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function AccountScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const traktAuth = useUserStore(s => s.traktAuth);

    const isAuthenticated = !!traktAuth?.accessToken;

    return (
        <SettingsSubpage title="Account">
            <View>
                <View style={styles.profileHeader}>
                    <View style={[styles.avatarContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                        <UserCircle size={48} color={theme.colors.primary} />
                    </View>
                    <View style={styles.profileInfo}>
                        <Typography variant="title-large" weight="bold" style={{ color: theme.colors.onSurface }}>
                            {traktAuth?.user?.name || traktAuth?.user?.username || 'Guest User'}
                        </Typography>
                        <Typography variant="body-medium" style={{ color: theme.colors.onSurfaceVariant }}>
                            {isAuthenticated ? 'Connected to Trakt' : 'Sign in to sync your library'}
                        </Typography>
                    </View>
                </View>

                <SettingsGroup title="Integrations">
                    <SettingsItem
                        icon={User}
                        label="Trakt.tv"
                        description={isAuthenticated ? "Account synced & active" : "Sync watch history across devices"}
                        onPress={() => router.push('/settings/trakt')}
                    />
                </SettingsGroup>

                {!isAuthenticated && (
                    <SettingsGroup title="Cloud Sync">
                        <SettingsItem
                            icon={LogIn}
                            label="Sign In"
                            description="Access your profile and favorites"
                            onPress={() => { }}
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
