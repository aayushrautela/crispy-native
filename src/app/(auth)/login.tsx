import { useTheme } from '@/src/core/ThemeContext';
import { supabase } from '@/src/core/services/supabase';
import { ExpressiveButton } from '@/src/core/ui/ExpressiveButton';
import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { SettingsItem } from '@/src/core/ui/SettingsItem';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { useRouter } from 'expo-router';
import { Lock, LogIn, Mail, User as UserIcon, UserPlus } from 'lucide-react-native';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 32;
const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

function normalizeUsername(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '_');
}

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
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
            if (isSignUp) {
                const normalizedUsername = normalizeUsername(username);
                if (
                    normalizedUsername.length < USERNAME_MIN_LENGTH
                    || normalizedUsername.length > USERNAME_MAX_LENGTH
                    || !USERNAME_REGEX.test(normalizedUsername)
                ) {
                    alert('Username must be 3-32 chars, lowercase, and can only use letters, numbers, dots, underscores, or hyphens.');
                    return;
                }

                const { data, error } = await supabase.auth.signUp({
                    email: normalizedEmail,
                    password,
                    options: {
                        data: {
                            username: normalizedUsername,
                            name: normalizedUsername,
                            full_name: normalizedUsername,
                        }
                    }
                });
                if (error) throw error;
                if (!data.session) {
                    alert('Please check your email for the confirmation link!');
                    return;
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
                if (error) throw error;
            }
            router.replace('/(auth)/profiles' as never);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setIsSignUp(!isSignUp);
    };

    return (
        <SettingsSubpage
            title={isSignUp ? 'Create Account' : 'Sign In'}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={styles.formContainer}>


                    <SettingsGroup title="Credentials">
                        {isSignUp && (
                            <>
                                <SettingsItem
                                    icon={UserIcon}
                                    label="Username"
                                    showChevron={false}
                                />
                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        value={username}
                                        onChangeText={setUsername}
                                        placeholder="username"
                                        placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                                        autoCapitalize="none"
                                        style={[styles.input, { backgroundColor: theme.colors.elevation.level2, color: theme.colors.onSurface }]}
                                    />
                                </View>
                            </>
                        )}

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
                            title={isSignUp ? 'Sign Up' : 'Sign In'}
                            onPress={handleAuth}
                            isLoading={loading}
                            icon={isSignUp ? UserPlus : LogIn}
                            style={styles.submitBtn}
                            size="lg"
                        />

                        <ExpressiveButton
                            title={isSignUp
                                ? 'Already have an account? Sign In'
                                : "Don't have an account? Sign Up"}
                            variant="text"
                            onPress={toggleMode}
                            disabled={loading}
                            style={styles.toggleBtn}
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
