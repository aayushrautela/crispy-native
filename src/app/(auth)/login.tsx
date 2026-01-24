import { supabase } from '@/src/core/services/supabase';
import { StorageService } from '@/src/core/storage';
import { useTheme } from '@/src/core/ThemeContext';
import { ExpressiveButton } from '@/src/core/ui/ExpressiveButton';
import { ExpressiveSurface } from '@/src/core/ui/ExpressiveSurface';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
                    return; // Don't redirect if email confirmation is required
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

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, { backgroundColor: theme.colors.background }]}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.colors.primary }]}>
                            {isSignUp ? 'Create Account' : 'Welcome Back'}
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                            {isSignUp ? 'Enter your details to get started' : 'Sign in to continue to Crispy'}
                        </Text>
                    </View>

                    <ExpressiveSurface style={styles.form} variant="elevated" rounding="2xl">
                        {isSignUp && (
                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: theme.colors.onSurface }]}>Full Name</Text>
                                <TextInput
                                    style={[styles.input, {
                                        backgroundColor: theme.colors.surfaceVariant,
                                        color: theme.colors.onSurface,
                                        borderRadius: 12
                                    }]}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="Enter your name"
                                    placeholderTextColor={theme.colors.outline}
                                />
                            </View>
                        )}

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.colors.onSurface }]}>Email</Text>
                            <TextInput
                                style={[styles.input, {
                                    backgroundColor: theme.colors.surfaceVariant,
                                    color: theme.colors.onSurface,
                                    borderRadius: 12
                                }]}
                                value={email}
                                onChangeText={setEmail}
                                placeholder="Enter your email"
                                placeholderTextColor={theme.colors.outline}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.colors.onSurface }]}>Password</Text>
                            <TextInput
                                style={[styles.input, {
                                    backgroundColor: theme.colors.surfaceVariant,
                                    color: theme.colors.onSurface,
                                    borderRadius: 12
                                }]}
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Enter your password"
                                placeholderTextColor={theme.colors.outline}
                                secureTextEntry
                            />
                        </View>

                        <ExpressiveButton
                            title={loading ? (isSignUp ? "Creating account..." : "Logging in...") : (isSignUp ? "Sign Up" : "Login")}
                            onPress={handleAuth}
                            style={styles.loginBtn}
                            disabled={loading}
                        />

                        <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.switchButton}>
                            <Text style={[styles.switchText, { color: theme.colors.primary }]}>
                                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                            </Text>
                        </TouchableOpacity>
                    </ExpressiveSurface>

                    <View style={styles.footer}>
                        <ExpressiveButton
                            title="Continue as Guest"
                            variant="text"
                            onPress={handleGuest}
                        />
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    content: {
        padding: 24,
        justifyContent: 'center',
        maxWidth: 500,
        alignSelf: 'center',
        width: '100%',
    },
    header: {
        marginBottom: 32,
        alignItems: 'center',
    },
    title: {
        fontSize: 32, // Adjusted for better mobile fit
        fontWeight: '800',
        letterSpacing: -1,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        marginTop: 8,
        textAlign: 'center',
    },
    form: {
        padding: 24,
        gap: 16,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 4,
    },
    input: {
        height: 56,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    loginBtn: {
        marginTop: 8,
    },
    switchButton: {
        alignItems: 'center',
        marginTop: 8,
        padding: 8,
    },
    switchText: {
        fontSize: 14,
        fontWeight: '600',
    },
    footer: {
        marginTop: 24,
        alignItems: 'center',
    }
});
