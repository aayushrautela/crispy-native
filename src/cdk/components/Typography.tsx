import React from 'react';
import { Text, TextProps } from 'react-native';
import { cn } from '@/src/lib/utils'; // I'll create this utility next

interface TypographyProps extends TextProps {
    variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label';
    weight?: 'normal' | 'medium' | 'semibold' | 'bold';
}

const variantStyles = {
    h1: 'text-3xl font-bold tracking-tight',
    h2: 'text-2xl font-semibold',
    h3: 'text-xl font-medium',
    body: 'text-base',
    caption: 'text-sm opacity-70',
    label: 'text-xs uppercase tracking-widest font-bold opacity-60',
};

export const Typography = ({
    variant = 'body',
    className,
    children,
    ...props
}: TypographyProps) => {
    return (
        <Text
            className={cn(variantStyles[variant], className)}
            {...props}
        >
            {children}
        </Text>
    );
};
