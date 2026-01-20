import { ExpressiveButton } from '@/src/cdk/components/ExpressiveButton';
import { SettingsGroup } from '@/src/cdk/components/SettingsGroup';
import { SettingsItem } from '@/src/cdk/components/SettingsItem';
import { Typography } from '@/src/cdk/components/Typography';
import { SettingsSubpage } from '@/src/cdk/layout/SettingsSubpage';
import { TraktDeviceCodeResponse } from '@/src/core/api/trakt-types';
import { TraktService } from '@/src/core/api/TraktService';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { CheckCircle2, Copy, ExternalLink, Globe, Layout, RefreshCw, XCircle } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Clipboard, StyleSheet, View } from 'react-native';

export default function TraktScreen() {
    const { theme } = useTheme();
    const traktAuth = useUserStore(s => s.traktAuth);
    const updateTraktAuth = useUserStore(s => s.updateTraktAuth);

    const [traktCode, setTraktCode] = useState<TraktDeviceCodeResponse | null>(null);
    const [isTraktLoading, setIsTraktLoading] = useState(false);
    const pollInterval = React.useRef<NodeJS.Timeout | null>(null);

    const isAuthenticated = !!traktAuth?.accessToken;

    React.useEffect(() => {
        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, []);

    const handleConnectTrakt = async () => {
        setIsTraktLoading(true);
        try {
            const code = await TraktService.oauthDeviceCode();
            setTraktCode(code);

            pollInterval.current = setInterval(async () => {
                try {
                    const auth = await TraktService.oauthToken(code.device_code);
                    if (auth.access_token) {
                        if (pollInterval.current) clearInterval(pollInterval.current);
                        setTraktCode(null);
                        updateTraktAuth(auth);
                        Alert.alert('Success', 'Trakt connected!');
                    }
                } catch (e) {
                    // Still pending or error
                }
            }, code.interval * 1000);

        } catch (e) {
            Alert.alert('Error', 'Failed to initialize Trakt auth');
        } finally {
            setIsTraktLoading(false);
        }
    };

    const handleDisconnectTrakt = () => {
        Alert.alert(
            'Disconnect Trakt',
            'Are you sure you want to log out of Trakt?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: () => {
                        if (pollInterval.current) clearInterval(pollInterval.current);
                        setTraktCode(null);
                        updateTraktAuth({});
                    }
                }
            ]
        );
    };

    const copyToClipboard = (text: string) => {
        Clipboard.setString(text);
        // We could show a toast here if we had a toast provider
    };

    return (
        <SettingsSubpage title="Trakt.tv">
            <View>
                <SettingsGroup title="Status">
                    <View style={styles.statusCard}>
                        <View style={styles.statusInfo}>
                            <Typography variant="title-medium" weight="bold" style={{ color: theme.colors.onSurface }}>
                                {isAuthenticated ? 'Trakt Connected' : 'Trakt Disconnected'}
                            </Typography>
                            <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                {isAuthenticated ? `Signed in as ${traktAuth?.user?.username || 'user'}` : 'Sync watch progress across devices'}
                            </Typography>
                        </View>
                        <ExpressiveButton
                            title={isAuthenticated ? "Logout" : "Connect"}
                            icon={isAuthenticated ? XCircle : Globe}
                            onPress={isAuthenticated ? handleDisconnectTrakt : handleConnectTrakt}
                            variant={isAuthenticated ? "tonal" : "primary"}
                            isLoading={isTraktLoading}
                        />
                    </View>

                    {traktCode && !isAuthenticated && (
                        <View style={[styles.authContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
                            <Typography variant="title-small" weight="bold" style={{ textAlign: 'center', marginBottom: 16 }}>
                                Authenticate on Trakt
                            </Typography>

                            <View style={styles.codeBox}>
                                <Typography variant="display-medium" weight="black" style={styles.userCode}>
                                    {traktCode.user_code}
                                </Typography>
                                <ExpressiveButton
                                    icon={Copy}
                                    onPress={() => copyToClipboard(traktCode.user_code)}
                                    variant="tonal"
                                    style={{ width: 48, height: 48, borderRadius: 24, padding: 0 }}
                                />
                            </View>

                            <Typography variant="body-small" style={styles.instructions}>
                                Visit {traktCode.verification_url} and enter the code above.
                            </Typography>

                            <View style={styles.pollingStatus}>
                                <RefreshCw size={14} color={theme.colors.onSurfaceVariant} style={styles.spinner} />
                                <Typography variant="label-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                    Waiting for authorization...
                                </Typography>
                            </View>

                            <ExpressiveButton
                                title="Open Trakt"
                                icon={ExternalLink}
                                variant="outline"
                                style={{ marginTop: 12 }}
                                onPress={() => { /* Link logic */ }}
                            />
                        </View>
                    )}
                </SettingsGroup>

                <SettingsGroup title="Features">
                    <SettingsItem
                        icon={RefreshCw}
                        label="Two-way Sync"
                        description="Keep watch history in sync between devices"
                        showChevron={false}
                        rightElement={<CheckCircle2 size={20} color={isAuthenticated ? theme.colors.primary : theme.colors.onSurfaceVariant + '40'} />}
                    />
                    <SettingsItem
                        icon={Layout}
                        label="Personalized Layout"
                        description="Show Trakt-specific lists on Home"
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
    authContainer: {
        marginHorizontal: 16,
        marginBottom: 20,
        padding: 20,
        borderRadius: 24,
    },
    codeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 16,
    },
    userCode: {
        letterSpacing: 4,
        color: '#FFD700', // Gold/primary-like color for emphasis
    },
    instructions: {
        textAlign: 'center',
        marginBottom: 12,
        opacity: 0.7,
    },
    pollingStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    spinner: {
        // Animation would be added here
    }
});
