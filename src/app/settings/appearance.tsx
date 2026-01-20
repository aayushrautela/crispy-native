import { ExpressiveSwitch } from '@/src/cdk/components/ExpressiveSwitch';
import { SettingsGroup } from '@/src/cdk/components/SettingsGroup';
import { SettingsItem } from '@/src/cdk/components/SettingsItem';
import { Typography } from '@/src/cdk/components/Typography';
import { SettingsSubpage } from '@/src/cdk/layout/SettingsSubpage';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { Palette, Smartphone, Zap } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const ACCENT_COLORS = [
    { name: 'Golden Amber', colorHex: '#FFC107' },
    { name: 'Sunset Orange', colorHex: '#FF5722' },
    { name: 'Crimson Rose', colorHex: '#E91E63' },
    { name: 'Neon Violet', colorHex: '#9C27B0' },
    { name: 'Cosmic Purple', colorHex: '#673AB7' },
    { name: 'Ocean Blue', colorHex: '#2196F3' },
    { name: 'Cyber Teal', colorHex: '#00BCD4' },
    { name: 'Toxic Emerald', colorHex: '#4CAF50' },
];

export default function AppearanceScreen() {
    const { theme } = useTheme();
    const { settings, updateSettings } = useUserStore();
    const { amoledMode, accentColor, useMaterialYou } = settings;

    return (
        <SettingsSubpage title="Appearance">
            <View>
                <SettingsGroup title="Theme">
                    <SettingsItem
                        icon={Smartphone}
                        label="AMOLED Mode"
                        description="Pitch black backgrounds for OLED"
                        rightElement={
                            <ExpressiveSwitch
                                value={amoledMode}
                                onValueChange={(val) => updateSettings({ amoledMode: val })}
                            />
                        }
                        showChevron={false}
                    />
                </SettingsGroup>

                <SettingsGroup title="Colors">
                    <SettingsItem
                        icon={Palette}
                        label="Material You"
                        description="Use system accent colors (Android 12+)"
                        showChevron={false}
                        rightElement={
                            <ExpressiveSwitch
                                value={useMaterialYou}
                                onValueChange={(val) => updateSettings({ useMaterialYou: val })}
                            />
                        }
                    />

                    {!useMaterialYou && (
                        <View style={styles.colorPickerContainer}>
                            <Typography
                                variant="label-medium"
                                style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12, marginLeft: 20 }}
                            >
                                CHOOSE ACCENT
                            </Typography>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.colorList}
                            >
                                {ACCENT_COLORS.map((color) => {
                                    const isSelected = accentColor === color.name;
                                    return (
                                        <TouchableOpacity
                                            key={color.name}
                                            onPress={() => updateSettings({ accentColor: color.name })}
                                            style={[
                                                styles.colorCircle,
                                                { backgroundColor: color.colorHex },
                                                isSelected && { borderColor: theme.colors.onSurface, borderWidth: 3 }
                                            ]}
                                        />
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    <SettingsItem
                        icon={Zap}
                        label="Active Theme"
                        description={useMaterialYou ? "System Dynamic Colors" : accentColor}
                        showChevron={false}
                    />
                </SettingsGroup>
            </View>
        </SettingsSubpage>
    );
}

const styles = StyleSheet.create({
    colorPickerContainer: {
        paddingVertical: 12,
    },
    colorList: {
        paddingHorizontal: 20,
        gap: 12,
    },
    colorCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
    }
});
