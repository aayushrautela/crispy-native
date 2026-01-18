import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/core/AuthContext';
import { useTheme } from '@/src/core/ThemeContext';
import { ExpressiveButton } from '@/src/cdk/components/ExpressiveButton';
import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { supabase } from '@/src/core/api/supabase';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { theme } = useTheme();
    const router = useRouter();

    const handleLogin = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            router.replace('/(tabs)');
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGuest = () => {
        router.replace('/(tabs)');
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, { backgroundColor: theme.colors.background }]}
        >
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={[styles.title, { color: theme.colors.primary }]}>Crispy</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                        Your native media center
                    </Text>
                </View>

                <ExpressiveSurface style={styles.form} variant="elevated" rounding="2xl">
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
                        title={loading ? "Logging in..." : "Login"}
                        onPress={handleLogin}
                        style={styles.loginBtn}
                    />
                </ExpressiveSurface>

                <View style={styles.footer}>
                    <ExpressiveButton
                        title="Continue as Guest"
                        variant="text"
                        onPress={handleGuest}
                    />
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
    },
    header: {
        marginBottom: 48,
        alignItems: 'center',
    },
    title: {
        fontSize: 48,
        fontWeight: '800',
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 16,
        marginTop: 8,
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
    footer: {
        marginTop: 24,
        alignItems: 'center',
    }
});
