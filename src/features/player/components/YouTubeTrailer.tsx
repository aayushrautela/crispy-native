import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface YouTubeTrailerProps {
    videoId: string;
    isMuted?: boolean;
    isPlaying?: boolean;
    isVisible?: boolean;
    style?: any;
}

export const YouTubeTrailer = ({ videoId, isMuted = true, isPlaying = true, isVisible = true, style }: YouTubeTrailerProps) => {
    const webviewRef = useRef<WebView>(null);

    useEffect(() => {
        if (webviewRef.current) {
            const js = `
                var v = document.querySelector('video');
                if (v) v.muted = ${isMuted};
                true;
            `;
            webviewRef.current.injectJavaScript(js);
        }
    }, [isMuted]);

    useEffect(() => {
        if (webviewRef.current) {
            const js = `
                var v = document.querySelector('video');
                if (v) { ${isPlaying ? 'v.play()' : 'v.pause()'} }
                true;
            `;
            webviewRef.current.injectJavaScript(js);
        }
    }, [isPlaying]);

    // Construct the embed URL with parameters to make it behave like a background video
    // origin=http://localhost: Required for some restricted videos to play (Error 150/153 fix)
    const uri = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${videoId}&modestbranding=1&playsinline=1&mute=1&enablejsapi=1&origin=http://localhost`;

    return (
        <View style={[styles.container, style, { opacity: isVisible ? 1 : 0 }]} pointerEvents="none">
            <View style={styles.oversizeWrapper}>
                <WebView
                    ref={webviewRef}
                    style={styles.webview}
                    source={{ uri, headers: { Referer: 'http://localhost' } }}
                    allowsInlineMediaPlayback={true}
                    mediaPlaybackRequiresUserAction={false}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    scrollEnabled={false}
                    // Transparent background to blend better if it loads slowly
                    backgroundColor="black"
                    opacity={0.99} // Android hack to prevent some rendering glitches
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'black',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    oversizeWrapper: {
        height: '100%',
        aspectRatio: 21 / 9, // Oversize width to push boundaries off-screen
    },
    webview: {
        flex: 1,
        backgroundColor: 'black',
        transform: [{ scale: 1.35 }], // Zoom in to crop cinematic black bars
    },
});
