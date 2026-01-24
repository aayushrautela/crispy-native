import { BottomSheetRef, CustomBottomSheet } from '@/src/core/ui/BottomSheet';
import { ExpressiveSurface } from '@/src/core/ui/ExpressiveSurface';
import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { SettingsItem } from '@/src/core/ui/SettingsItem';
import { Typography } from '@/src/core/ui/Typography';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { Check, Languages, Subtitles, Volume2 } from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

const LANGUAGES = [
    { label: 'Arabic', value: 'ar' },
    { label: 'Bengali', value: 'bn' },
    { label: 'Chinese (Simplified)', value: 'zh' },
    { label: 'Chinese (Traditional)', value: 'zt' },
    { label: 'Czech', value: 'cs' },
    { label: 'Danish', value: 'da' },
    { label: 'Dutch', value: 'nl' },
    { label: 'English', value: 'en' },
    { label: 'Finnish', value: 'fi' },
    { label: 'French', value: 'fr' },
    { label: 'German', value: 'de' },
    { label: 'Greek', value: 'el' },
    { label: 'Hebrew', value: 'he' },
    { label: 'Hindi', value: 'hi' },
    { label: 'Hungarian', value: 'hu' },
    { label: 'Indonesian', value: 'id' },
    { label: 'Italian', value: 'it' },
    { label: 'Japanese', value: 'ja' },
    { label: 'Korean', value: 'ko' },
    { label: 'Malay', value: 'ms' },
    { label: 'Norwegian', value: 'no' },
    { label: 'Persian', value: 'fa' },
    { label: 'Polish', value: 'pl' },
    { label: 'Portuguese', value: 'pt' },
    { label: 'Romanian', value: 'ro' },
    { label: 'Russian', value: 'ru' },
    { label: 'Spanish', value: 'es' },
    { label: 'Swedish', value: 'sv' },
    { label: 'Thai', value: 'th' },
    { label: 'Turkish', value: 'tr' },
    { label: 'Ukrainian', value: 'uk' },
    { label: 'Vietnamese', value: 'vi' },
];

export default function LanguageScreen() {
    const { theme } = useTheme();
    const { settings, updateSettings } = useUserStore();
    const { language, audioLanguage, subtitleLanguage } = settings;

    const [activeKey, setActiveKey] = useState<'language' | 'audioLanguage' | 'subtitleLanguage' | null>(null);
    const bottomSheetRef = useRef<BottomSheetRef>(null);

    const openSelector = useCallback((key: typeof activeKey) => {
        setActiveKey(key);
        bottomSheetRef.current?.present();
    }, []);

    const onSelect = useCallback((val: string) => {
        if (activeKey) {
            updateSettings({ [activeKey]: val });
            bottomSheetRef.current?.dismiss();
        }
    }, [activeKey, updateSettings]);

    const getAppTitle = () => {
        switch (activeKey) {
            case 'language': return 'App Language';
            case 'audioLanguage': return 'Audio Language';
            case 'subtitleLanguage': return 'Subtitle Language';
            default: return 'Select Language';
        }
    };

    const getSelectedLabel = (val: string) => LANGUAGES.find(l => l.value === val)?.label || val;

    return (
        <SettingsSubpage title="Language">
            <View>
                <SettingsGroup title="Interface">
                    <SettingsItem
                        icon={Languages}
                        label="App Language"
                        description={getSelectedLabel(language)}
                        onPress={() => openSelector('language')}
                    />
                </SettingsGroup>

                <SettingsGroup title="Audio">
                    <SettingsItem
                        icon={Volume2}
                        label="Preferred Audio"
                        description={getSelectedLabel(audioLanguage)}
                        onPress={() => openSelector('audioLanguage')}
                    />
                </SettingsGroup>

                <SettingsGroup title="Subtitles">
                    <SettingsItem
                        icon={Subtitles}
                        label="Preferred Subtitles"
                        description={getSelectedLabel(subtitleLanguage)}
                        onPress={() => openSelector('subtitleLanguage')}
                    />
                </SettingsGroup>
            </View>

            <CustomBottomSheet
                ref={bottomSheetRef}
                title={getAppTitle()}
            >
                <View style={styles.sheetContent}>
                    {LANGUAGES.map((lang) => {
                        const currentValue = activeKey ? settings[activeKey] : null;
                        const isSelected = currentValue === lang.value;
                        return (
                            <ExpressiveSurface
                                key={lang.value}
                                onPress={() => onSelect(lang.value)}
                                variant={isSelected ? 'tonal' : 'tonal'}
                                rounding="full"
                                style={[
                                    styles.sheetChip,
                                    isSelected
                                        ? { backgroundColor: theme.colors.secondaryContainer }
                                        : { backgroundColor: theme.colors.surfaceContainerLow }
                                ]}
                            >
                                <View style={styles.sheetOptionInner}>
                                    <Typography
                                        variant="body-large"
                                        style={{
                                            color: isSelected ? theme.colors.onSecondaryContainer : theme.colors.onSurface
                                        }}
                                    >
                                        {lang.label}
                                    </Typography>
                                    {isSelected && (
                                        <Check size={20} color={theme.colors.onSecondaryContainer} />
                                    )}
                                </View>
                            </ExpressiveSurface>
                        );
                    })}
                </View>
            </CustomBottomSheet>
        </SettingsSubpage>
    );
}

const styles = StyleSheet.create({
    sheetContent: {
        paddingHorizontal: 20,
        gap: 8,
        paddingBottom: 40,
    },
    sheetChip: {
        width: '100%',
        height: 56,
        paddingHorizontal: 0,
        paddingVertical: 0,
    },
    sheetOptionInner: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 20,
        paddingRight: 20,
    },
});
