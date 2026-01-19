import { useTheme } from '@/src/core/ThemeContext';
import { cn } from '@/src/lib/utils';
import React from 'react';
import { Text, TextProps } from 'react-native';

interface TypographyProps extends TextProps {
    variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label';
    weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'black';
}

const variantStyles = {
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
