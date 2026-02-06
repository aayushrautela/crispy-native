import 'react-native-paper';

declare module 'react-native-paper' {
    // Some parts of the app use Material You surface container colors.
    // React Native Paper's MD3Colors typing does not include these yet.
    export interface MD3Colors {
        surfaceContainer?: string;
        surfaceContainerLowest?: string;
        surfaceContainerLow?: string;
        surfaceContainerHigh?: string;
        surfaceContainerHighest?: string;
    }
}

export {};
