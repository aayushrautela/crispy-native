import { useAuth } from '@/src/core/AuthContext';
import { useTheme } from '@/src/core/ThemeContext';
import { ExpressiveButton } from '@/src/core/ui/ExpressiveButton';
import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { Typography } from '@/src/core/ui/Typography';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { useRouter } from 'expo-router';
import { Plus, User, UserCheck, UserMinus } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

export default function ProfilesScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const {
        knownAccounts,
        activeAccount,
        mode,
        switchAccount,
        continueAsGuest,
        removeAccount,
    } = useAuth();

    const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);
    const [guestLoading, setGuestLoading] = useState(false);
    const [removeLoadingId, setRemoveLoadingId] = useState<string | null>(null);

    const activeAccountId = mode === 'account' ? activeAccount?.user_id : null;

    const handleAccountPress = async (userId: string) => {
        if (pendingAccountId || guestLoading || removeLoadingId) return;

        if (activeAccountId === userId) {
            router.replace('/(tabs)');
            return;
        }

        setPendingAccountId(userId);
        try {
            await switchAccount(userId);
            router.replace('/(tabs)');
        } catch (error: any) {
            Alert.alert('Unable to switch account', error?.message || 'Please try again.');
        } finally {
            setPendingAccountId(null);
        }
    };

    const handleContinueAsGuest = async () => {
        if (pendingAccountId || guestLoading || removeLoadingId) return;

        setGuestLoading(true);
        try {
            await continueAsGuest();
            router.replace('/(tabs)');
        } catch (error: any) {
            Alert.alert('Unable to continue as guest', error?.message || 'Please try again.');
        } finally {
            setGuestLoading(false);
        }
    };

    const handleRemoveAccount = (userId: string, label: string) => {
        Alert.alert(
            'Remove Account',
            `Remove ${label} from this device?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        setRemoveLoadingId(userId);
                        try {
                            await removeAccount(userId);
                        } catch (error: any) {
                            Alert.alert('Unable to remove account', error?.message || 'Please try again.');
                        } finally {
                            setRemoveLoadingId(null);
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
                        Continue with a profile
                    </Typography>
                    <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                        Switch instantly between saved accounts or use local guest mode.
                    </Typography>
                </View>

                <SettingsGroup title="Saved Profiles">
                    {knownAccounts.length > 0 ? (
                        knownAccounts.map((account) => {
                            const isCurrent = account.user_id === activeAccountId;
                            const isSwitching = pendingAccountId === account.user_id;
                            const isRemoving = removeLoadingId === account.user_id;
                            const label = account.name || account.email || 'Crispy User';

                            return (
                                <Pressable
                                    key={account.user_id}
                                    onPress={() => void handleAccountPress(account.user_id)}
                                    disabled={isSwitching || isRemoving || guestLoading || !!pendingAccountId || !!removeLoadingId}
                                    style={({ pressed }) => [
                                        styles.accountRow,
                                        pressed && styles.accountRowPressed,
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

                                    <View style={styles.accountMeta}>
                                        <Typography variant="title-small" weight="semibold" style={{ color: theme.colors.onSurface }}>
                                            {label}
                                        </Typography>
                                        <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {account.email}
                                        </Typography>
                                    </View>

                                    <View style={styles.accountActions}>
                                        {isCurrent && (
                                            <View style={[styles.badge, { backgroundColor: theme.colors.secondaryContainer }]}>
                                                <Typography variant="label-small" weight="bold" style={{ color: theme.colors.onSecondaryContainer }}>
                                                    Current
                                                </Typography>
                                            </View>
                                        )}

                                        <Pressable
                                            onPress={(event) => {
                                                event.stopPropagation();
                                                handleRemoveAccount(account.user_id, label);
                                            }}
                                            disabled={isRemoving || !!pendingAccountId || guestLoading || !!removeLoadingId}
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
                                No saved accounts yet.
                            </Typography>
                            <Typography variant="body-small" style={{ color: theme.colors.outline }}>
                                Add an account to enable one-tap switching.
                            </Typography>
                        </View>
                    )}
                </SettingsGroup>

                <View style={styles.actions}>
                    <ExpressiveButton
                        title="Add Account"
                        icon={Plus}
                        variant="tonal"
                        onPress={() => router.push('/(auth)/login?mode=add-account')}
                        disabled={!!pendingAccountId || guestLoading || !!removeLoadingId}
                    />

                    <ExpressiveButton
                        title="Continue as Guest"
                        variant="outline"
                        onPress={handleContinueAsGuest}
                        isLoading={guestLoading}
                        disabled={!!pendingAccountId || !!removeLoadingId}
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
    accountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 12,
    },
    accountRowPressed: {
        opacity: 0.85,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    accountMeta: {
        flex: 1,
        gap: 2,
    },
    accountActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    badge: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
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
    actions: {
        paddingHorizontal: 20,
        gap: 10,
    },
});
