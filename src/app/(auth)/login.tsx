import { useTheme } from '@/src/core/ThemeContext';
import { supabase } from '@/src/core/services/supabase';
import { StorageService } from '@/src/core/storage';
import { ExpressiveButton } from '@/src/core/ui/ExpressiveButton';
import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { SettingsItem } from '@/src/core/ui/SettingsItem';
import { Typography } from '@/src/core/ui/Typography';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { useRouter } from 'expo-router';
import { Lock, LogIn, Mail, User as UserIcon, UserPlus } from 'lucide-react-native';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const { theme } = useTheme();
    const router = useRouter();

    const handleAuth = async () => {
        setLoading(true);
        try {
            StorageService.removeGlobal('crispy-guest-mode');
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            name: name || email.split('@')[0],
                            full_name: name || email.split('@')[0]
                        }
                    }
                });
                if (error) throw error;
                if (!data.session) {
                    alert('Please check your email for the confirmation link!');
                    return;
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            }
            router.replace('/(tabs)');
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGuest = () => {
        StorageService.setGlobal('crispy-guest-mode', 'true');
        router.replace('/(tabs)');
    };

    const toggleMode = () => {
        setIsSignUp(!isSignUp);
    };

    return (
        <SettingsSubpage title={isSignUp ? "Create Account" : "Sign In"}>
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
                                    label="Full Name"
                                    showChevron={false}
                                />
                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        value={name}
                                        onChangeText={setName}
                                        placeholder="Your Name"
                                        placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
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
                            title={isSignUp ? "Sign Up" : "Sign In"}
                            onPress={handleAuth}
                            isLoading={loading}
                            icon={isSignUp ? UserPlus : LogIn}
                            style={styles.submitBtn}
                            size="lg"
                        />

                        <ExpressiveButton
                            title={isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
                            variant="text"
                            onPress={toggleMode}
                            style={styles.toggleBtn}
                        />

                        <View style={styles.divider}>
                            <View style={[styles.line, { backgroundColor: theme.colors.outlineVariant }]} />
                            <Typography variant="label-small" style={{ color: theme.colors.outline, marginHorizontal: 16 }}>
                                OR
                            </Typography>
                            <View style={[styles.line, { backgroundColor: theme.colors.outlineVariant }]} />
                        </View>

                        <ExpressiveButton
                            title="Continue as Guest"
                            variant="tonal"
                            onPress={handleGuest}
                            size="md"
                            style={styles.guestBtn}
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
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 32,
    },
    line: {
        flex: 1,
        height: 1,
    },
    guestBtn: {
        width: '100%',
    },
});
