import { SettingsGroup } from '@/src/cdk/components/SettingsGroup';
import { SettingsItem } from '@/src/cdk/components/SettingsItem';
import { Typography } from '@/src/cdk/components/Typography';
import { SettingsSubpage } from '@/src/cdk/layout/SettingsSubpage';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { Languages, Subtitles, Volume2 } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const LANGUAGES = [
    { label: 'English', value: 'en' },
    { label: 'Spanish', value: 'es' },
    { label: 'French', value: 'fr' },
    { label: 'German', value: 'de' },
    { label: 'Italian', value: 'it' },
    { label: 'Japanese', value: 'ja' },
    { label: 'Korean', value: 'ko' },
    { label: 'Chinese', value: 'zh' },
];

export default function LanguageScreen() {
    const { theme } = useTheme();
    const { settings, updateSettings } = useUserStore();
    const { language, audioLanguage, subtitleLanguage } = settings;

    const renderLanguagePicker = (
        currentValue: string,
        onSelect: (val: string) => void
    ) => (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pickerScroll}
        >
            {LANGUAGES.map((lang) => {
                const isSelected = currentValue === lang.value;
                return (
                    <TouchableOpacity
                        key={lang.value}
                        onPress={() => onSelect(lang.value)}
                        style={[
                            styles.langChip,
                            {
                                backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceContainerHigh,
                            }
                        ]}
                    >
                        <Typography
                            variant="label-large"
                            style={{ color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface }}
                        >
                            {lang.label}
                        </Typography>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );

    return (
        <SettingsSubpage title="Language">
            <View>
                <SettingsGroup title="Interface">
                    <SettingsItem
                        icon={Languages}
                        label="App Language"
                        description="Changes the application interface language"
                        showChevron={false}
                    />
                    <View style={styles.pickerContainer}>
                        {renderLanguagePicker(language, (val) => updateSettings({ language: val }))}
                    </View>
                </SettingsGroup>

                <SettingsGroup title="Audio">
                    <SettingsItem
                        icon={Volume2}
                        label="Preferred Audio"
                        description="Sets the default audio track language"
                        showChevron={false}
                    />
                    <View style={styles.pickerContainer}>
                        {renderLanguagePicker(audioLanguage, (val) => updateSettings({ audioLanguage: val }))}
                    </View>
                </SettingsGroup>

                <SettingsGroup title="Subtitles">
                    <SettingsItem
                        icon={Subtitles}
                        label="Preferred Subtitles"
                        description="Sets the default subtitle language"
                        showChevron={false}
                    />
                    <View style={styles.pickerContainer}>
                        {renderLanguagePicker(subtitleLanguage, (val) => updateSettings({ subtitleLanguage: val }))}
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
    langChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    }
});
