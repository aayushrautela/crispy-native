import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { SettingsItem } from '@/src/core/ui/SettingsItem';
import { Typography } from '@/src/core/ui/Typography';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { useUserStore } from '@/src/features/trakt/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { Baseline, MoveVertical, Palette, Type } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const SIZES = [
    { label: 'Small', value: 75 },
    { label: 'Normal', value: 100 },
    { label: 'Large', value: 125 },
    { label: 'Extra', value: 150 },
    { label: 'Huge', value: 200 },
];

const COLORS = [
    { label: 'White', value: '#FFFFFF' },
    { label: 'Yellow', value: '#FFEB3B' },
    { label: 'Cyan', value: '#00BCD4' },
    { label: 'Green', value: '#4CAF50' },
    { label: 'Magenta', value: '#E91E63' },
    { label: 'Red', value: '#F44336' },
];

const OPACITIES = [
    { label: '0%', value: '#00000000' },
    { label: '25%', value: '#00000040' },
    { label: '50%', value: '#00000080' },
    { label: '75%', value: '#000000C0' },
    { label: '100%', value: '#000000' },
];

export default function SubtitlesScreen() {
    const { theme } = useTheme();
    const { settings, updateSettings } = useUserStore();
    const { subtitleSize, subtitleColor, subtitleBackColor, subtitlePosition } = settings;

    return (
        <SettingsSubpage title="Subtitles">
            <View>
                <SettingsGroup title="Appearance">
                    <SettingsItem
                        icon={Type}
                        label="Font Size"
                        description={`${subtitleSize}% scaling`}
                        showChevron={false}
                    />
                    <View style={styles.pickerContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerScroll}>
                            {SIZES.map((size) => {
                                const isSelected = subtitleSize === size.value;
                                return (
                                    <TouchableOpacity
                                        key={size.value}
                                        onPress={() => updateSettings({ subtitleSize: size.value })}
                                        style={[styles.chip, { backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceContainerHigh }]}
                                    >
                                        <Typography variant="label-large" style={{ color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface }}>
                                            {size.label}
                                        </Typography>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    <SettingsItem
                        icon={Baseline}
                        label="Text Color"
                        description="Color of the subtitle text"
                        showChevron={false}
                    />
                    <View style={styles.pickerContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerScroll}>
                            {COLORS.map((color) => {
                                const isSelected = subtitleColor === color.value;
                                return (
                                    <TouchableOpacity
                                        key={color.value}
                                        onPress={() => updateSettings({ subtitleColor: color.value })}
                                        style={[
                                            styles.colorCircle,
                                            { backgroundColor: color.value },
                                            isSelected && { borderColor: theme.colors.onSurface, borderWidth: 3 }
                                        ]}
                                    />
                                );
                            })}
                        </ScrollView>
                    </View>

                    <SettingsItem
                        icon={Palette}
                        label="Background Opacity"
                        description="Visibility of the subtitle background"
                        showChevron={false}
                    />
                    <View style={styles.pickerContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerScroll}>
                            {OPACITIES.map((op) => {
                                const isSelected = subtitleBackColor === op.value;
                                return (
                                    <TouchableOpacity
                                        key={op.value}
                                        onPress={() => updateSettings({ subtitleBackColor: op.value })}
                                        style={[styles.chip, { backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceContainerHigh }]}
                                    >
                                        <Typography variant="label-large" style={{ color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface }}>
                                            {op.label}
                                        </Typography>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </SettingsGroup>

                <SettingsGroup title="Layout">
                    <SettingsItem
                        icon={MoveVertical}
                        label="Vertical Position"
                        description={`${subtitlePosition}% from bottom`}
                        showChevron={false}
                    />
                    <View style={styles.pickerContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerScroll}>
                            {[0, 2, 5, 10, 15, 20].map((pos) => {
                                const isSelected = subtitlePosition === pos;
                                return (
                                    <TouchableOpacity
                                        key={pos}
                                        onPress={() => updateSettings({ subtitlePosition: pos })}
                                        style={[styles.chip, { backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceContainerHigh }]}
                                    >
                                        <Typography variant="label-large" style={{ color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface }}>
                                            {pos}%
                                        </Typography>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </SettingsGroup>
            </View>
        </SettingsSubpage>
    );
}

const styles = StyleSheet.create({
    pickerContainer: {
        paddingVertical: 12,
        paddingBottom: 20,
    },
    pickerScroll: {
        paddingHorizontal: 20,
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    colorCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
    }
});
