import { useTheme } from '@/src/core/ThemeContext';
import { cn } from '@/src/lib/utils';
import React from 'react';
import { Text, TextProps } from 'react-native';

interface TypographyProps extends TextProps {
    variant?:
    | 'display-large' | 'display-medium' | 'display-small'
    | 'headline-large' | 'headline-medium' | 'headline-small'
    | 'title-large' | 'title-medium' | 'title-small'
    | 'body-large' | 'body-medium' | 'body-small'
    | 'label-large' | 'label-medium' | 'label-small'
    | 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label'; // Legacy support
    weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'black';
}

const variantStyles = {
    // MD3 Scale
    'display-large': 'text-[57px] leading-[64px] tracking-[-0.25px] font-normal',
    'display-medium': 'text-[45px] leading-[52px] tracking-normal font-normal',
    'display-small': 'text-[36px] leading-[44px] tracking-normal font-normal',

    'headline-large': 'text-[32px] leading-[40px] tracking-normal font-normal',
    'headline-medium': 'text-[28px] leading-[36px] tracking-normal font-normal',
    'headline-small': 'text-[24px] leading-[32px] tracking-normal font-normal',

    'title-large': 'text-[22px] leading-[28px] tracking-normal font-normal',
    'title-medium': 'text-[16px] leading-[24px] tracking-[0.15px] font-medium',
    'title-small': 'text-[14px] leading-[20px] tracking-[0.1px] font-medium',

    'body-large': 'text-[16px] leading-[24px] tracking-[0.5px] font-normal',
    'body-medium': 'text-[14px] leading-[20px] tracking-[0.25px] font-normal',
    'body-small': 'text-[12px] leading-[16px] tracking-[0.4px] font-normal',

    'label-large': 'text-[14px] leading-[20px] tracking-[0.1px] font-medium',
    'label-medium': 'text-[12px] leading-[16px] tracking-[0.5px] font-medium',
    'label-small': 'text-[11px] leading-[16px] tracking-[0.5px] font-medium',

    // Legacy Mappings
    h1: 'text-4xl tracking-tighter font-black',
    h2: 'text-2xl tracking-tight font-bold',
    h3: 'text-xl tracking-tight font-semibold',
    body: 'text-base',
    caption: 'text-sm opacity-80',
    label: 'text-[11px] uppercase tracking-[0.15em] font-bold',
};

const weightStyles = {
    light: 'font-light',
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
    black: 'font-black',
};

export const Typography = ({
    variant = 'body',
    weight,
    className,
    children,
    style,
    ...props
}: TypographyProps) => {
    const { theme } = useTheme();

    return (
        <Text
            className={cn(variantStyles[variant], weight && weightStyles[weight], className)}
            style={[
                { color: theme.colors.onSurface },
                style,
            ]}
            {...props}
        >
            {children}
        </Text>
    );
};
