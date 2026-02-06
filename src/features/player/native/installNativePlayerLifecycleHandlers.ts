import CrispyNativeCore from '@/modules/crispy-native-core';
import { DeviceEventEmitter, Platform } from 'react-native';
import { useNativePlayerSessionStore } from './nativePlayerSessionStore';

let installed = false;

export function installNativePlayerLifecycleHandlers() {
    if (installed) return;
    installed = true;

    if (Platform.OS !== 'android') return;

    DeviceEventEmitter.addListener('onNativePlayerClosed', (sessionId: string) => {
        if (typeof sessionId !== 'string' || !sessionId) return;
        void CrispyNativeCore.destroyStream(sessionId);
        useNativePlayerSessionStore.getState().removeSession(sessionId);
    });
}

installNativePlayerLifecycleHandlers();
