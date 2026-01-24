import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { SettingsItem } from '@/src/core/ui/SettingsItem';
import { Typography } from '@/src/core/ui/Typography';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { useTheme } from '@/src/core/ThemeContext';
import { Github, Globe, Heart, Shield } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function AboutScreen() {
    const { theme } = useTheme();

    return (
        <SettingsSubpage title="About">
            <View>
                <View style={styles.header}>
                    <View style={[styles.logo, { backgroundColor: theme.colors.primary }]}>
                        <Typography variant="display-medium" weight="black" style={{ color: 'white' }}>C</Typography>
                    </View>
                    <Typography variant="headline-large" weight="black" rounded style={{ color: theme.colors.onSurface }}>
                        Crispy
                    </Typography>
                    <Typography variant="body-medium" style={{ color: theme.colors.onSurfaceVariant }}>
                        Version 1.0.0 Alpha
                    </Typography>
                </View>

                <SettingsGroup title="Links">
                    <SettingsItem
                        icon={Github}
                        label="GitHub"
                        description="View source code and contribute"
                        onPress={() => { }}
                    />
                    <SettingsItem
                        icon={Globe}
                        label="Website"
                        description="Official documentation"
                        onPress={() => { }}
                    />
                </SettingsGroup>

                <SettingsGroup title="Legal">
                    <SettingsItem
                        icon={Shield}
                        label="Privacy Policy"
                        onPress={() => { }}
                    />
                    <SettingsItem
                        icon={Heart}
                        label="Open Source Licenses"
                        onPress={() => { }}
                    />
                </SettingsGroup>

                <View style={styles.footer}>
                    <Typography variant="label-small" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                        Crispy is an open-source media center for the modern era.{"\n"}
                        Built with React Native and Expo.
                    </Typography>
                </View>
            </View>
        </SettingsSubpage>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingVertical: 32,
        alignItems: 'center',
    },
    logo: {
        width: 96,
        height: 96,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    footer: {
        padding: 32,
        alignItems: 'center',
    }
});
