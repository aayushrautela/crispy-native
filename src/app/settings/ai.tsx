import { SettingsGroup } from '@/src/cdk/components/SettingsGroup';
import { SettingsItem } from '@/src/cdk/components/SettingsItem';
import { Typography } from '@/src/cdk/components/Typography';
import { SettingsSubpage } from '@/src/cdk/layout/SettingsSubpage';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { Brain, Cpu, Key } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const MODES = [
    { label: 'Off', value: 'off' },
    { label: 'On Demand', value: 'on-demand' },
    { label: 'Always', value: 'always' },
];

const MODELS = [
    { label: 'DeepSeek R1', value: 'deepseek-r1' },
    { label: 'Nvidia Nemotron', value: 'nvidia-nemotron' },
    { label: 'Custom', value: 'custom' },
];

export default function AiScreen() {
    const { theme } = useTheme();
    const { settings, updateSettings } = useUserStore();
    const { aiInsightsMode, openRouterKey, aiModelType, aiCustomModelName } = settings;

    return (
        <SettingsSubpage title="AI Insights">
            <View>
                <SettingsGroup title="General">
                    <SettingsItem
                        icon={Brain}
                        label="AI Insights Mode"
                        description="How summaries should be generated"
                        showChevron={false}
                    />
                    <View style={styles.pickerContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerScroll}>
                            {MODES.map((mode) => {
                                const isSelected = aiInsightsMode === mode.value;
                                return (
                                    <TouchableOpacity
                                        key={mode.value}
                                        onPress={() => updateSettings({ aiInsightsMode: mode.value as any })}
                                        style={[styles.chip, { backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceContainerHigh }]}
                                    >
                                        <Typography variant="label-large" style={{ color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface }}>
                                            {mode.label}
                                        </Typography>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </SettingsGroup>

                <SettingsGroup title="Configuration">
                    <SettingsItem
                        icon={Key}
                        label="OpenRouter Key"
                        description="Required for AI generation"
                        showChevron={false}
                    />
                    <View style={styles.inputContainer}>
                        <TextInput
                            value={openRouterKey}
                            onChangeText={(text) => updateSettings({ openRouterKey: text })}
                            placeholder="sk-or-v1-..."
                            placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                            secureTextEntry
                            style={[styles.input, { backgroundColor: theme.colors.surfaceContainerHighest, color: theme.colors.onSurface }]}
                        />
                    </View>
                </SettingsGroup>

                <SettingsGroup title="AI Model">
                    <SettingsItem
                        icon={Cpu}
                        label="Preferred Model"
                        description="LLM used for processing"
                        showChevron={false}
                    />
                    <View style={styles.pickerContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerScroll}>
                            {MODELS.map((model) => {
                                const isSelected = aiModelType === model.value;
                                return (
                                    <TouchableOpacity
                                        key={model.value}
                                        onPress={() => updateSettings({ aiModelType: model.value as any })}
                                        style={[styles.chip, { backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceContainerHigh }]}
                                    >
                                        <Typography variant="label-large" style={{ color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface }}>
                                            {model.label}
                                        </Typography>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {aiModelType === 'custom' && (
                        <View style={styles.inputContainer}>
                            <TextInput
                                value={aiCustomModelName}
                                onChangeText={(text) => updateSettings({ aiCustomModelName: text })}
                                placeholder="Custom Model Name"
                                placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                                style={[styles.input, { backgroundColor: theme.colors.surfaceContainerHighest, color: theme.colors.onSurface }]}
                            />
                        </View>
                    )}
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
    inputContainer: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    input: {
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
    }
});
