import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

export function useMeasuredWidth(initialWidth = 0) {
    const [width, setWidth] = useState(initialWidth);

    const onLayout = useCallback((e: LayoutChangeEvent) => {
        const nextWidth = Math.round(e.nativeEvent.layout.width);
        setWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    }, []);

    return { width, onLayout };
}
