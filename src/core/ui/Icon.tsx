import React from 'react';
import { LucideIcon, LucideProps } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

// NativeWind Interop for Lucide Icons
// This allows passing className directly to the Icon component
export const createIcon = (Icon: LucideIcon) => {
    cssInterop(Icon, {
        className: {
            target: 'style',
            nativeStyleToProp: {
                color: true,
                width: 'size',
                height: 'size',
            },
        },
    });
    return Icon;
};

interface IconProps extends LucideProps {
    icon: LucideIcon;
    className?: string;
}

export const Icon = ({ icon: LucideIcon, className, size = 24, ...props }: IconProps) => {
    // We apply interop to the specific icon instance if possible, 
    // but for simplicity we'll just wrap it.
    return (
        <LucideIcon
            className={className}
            size={size}
            {...props}
        />
    );
};
