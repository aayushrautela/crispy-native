import { useTheme } from '@/src/core/ThemeContext';
import { supabase } from '@/src/core/services/supabase';
import { ExpressiveButton } from '@/src/core/ui/ExpressiveButton';
import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { SettingsItem } from '@/src/core/ui/SettingsItem';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { Typography } from '@/src/core/ui/Typography';
import { useRouter } from 'expo-router';
import { Lock, LogIn, Mail, ExternalLink } from 'lucide-react-native';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View, Linking } from 'react-native';

const ACCOUNT_WEB_URL = 'https://crispy-account-management.vercel.app/auth/signup';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { theme } = useTheme();
    const router = useRouter();

    const handleAuth = async () => {
        const normalizedEmail = email.trim().toLowerCase();

        if (!normalizedEmail) {
            alert('Email is required.');
            return;
        }

        if (!password) {
            alert('Password is required.');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
            if (error) throw error;
            router.replace('/(auth)/profiles' as never);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SettingsSubpage
            title="Sign In"
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={styles.formContainer}>


                    <SettingsGroup title="Credentials">
                        <SettingsItem
                            icon={Mail}
                            label="Email Address"
                            showChevron={false}
                        />
                        <View style={styles.inputWrapper}>
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder="email@example.com"
                                placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                style={[styles.input, { backgroundColor: theme.colors.elevation.level2, color: theme.colors.onSurface }]}
                            />
                        </View>

                        <SettingsItem
                            icon={Lock}
                            label="Password"
                            showChevron={false}
                        />
                        <View style={styles.inputWrapper}>
                            <TextInput
                                value={password}
                                onChangeText={setPassword}
                                placeholder="••••••••"
                                placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                                secureTextEntry
                                style={[styles.input, { backgroundColor: theme.colors.elevation.level2, color: theme.colors.onSurface }]}
                            />
                        </View>
                    </SettingsGroup>

                    <View style={styles.actionContainer}>
                        <ExpressiveButton
                            title="Sign In"
                            onPress={handleAuth}
                            isLoading={loading}
                            icon={LogIn}
                            style={styles.submitBtn}
                            size="lg"
                        />

                        <ExpressiveButton
                            title="Create Account on Web"
                            onPress={() => Linking.openURL(ACCOUNT_WEB_URL)}
                            icon={ExternalLink}
                            variant="text"
                            style={{ marginTop: 12 }}
                        />
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SettingsSubpage>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    formContainer: {
        paddingTop: 8,
    },
    inputWrapper: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    input: {
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
    },
    actionContainer: {
        paddingHorizontal: 20,
        marginTop: 8,
    },
    submitBtn: {
        width: '100%',
    },
    toggleBtn: {
        marginTop: 12,
        width: '100%',
    },
});
