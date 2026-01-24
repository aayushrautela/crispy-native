import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface YouTubeTrailerProps {
    videoId: string;
    style?: any;
}

export const YouTubeTrailer = ({ videoId, style }: YouTubeTrailerProps) => {
    // Construct the embed URL with parameters to make it behave like a background video
    // controls=0: Hide player controls
    // showinfo=0: Hide text info (deprecated but still used by some)
    // rel=0: Show related videos from the same channel only (best we can do)
    // autoplay=1: Auto start
    // loop=1: Loop (optional, but good for backgrounds)
    // playlist={videoId}: Required for loop to work
    // modestbranding=1: Minimal YouTube branding
    // playsinline=1: Play inside the webview, not full screen
    const uri = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${videoId}&modestbranding=1&playsinline=1&mute=1`;

    return (
        <View style={[styles.container, style]} pointerEvents="none">
            <WebView
                style={styles.webview}
                source={{ uri }}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled={true}
                scrollEnabled={false}
                // Transparent background to blend better if it loads slowly
                backgroundColor="transparent"
                opacity={0.99} // Android hack to prevent some rendering glitches
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'black',
    },
    webview: {
        flex: 1,
        backgroundColor: 'black',
    },
});
