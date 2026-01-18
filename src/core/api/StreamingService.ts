import CrispyNativeCore from '../../../modules/crispy-native-core';

export class StreamingService {
    /**
     * Resolves a stream (e.g. infoHash) into a localhost URL.
     * If the input is already a URL, it is returned as is.
     */
    static async resolveStream(stream: { url?: string; infoHash?: string; fileIdx?: number }): Promise<string | null> {
        if (stream.url) {
            return stream.url;
        }

        if (stream.infoHash) {
            console.log('[StreamingService] Resolving infoHash:', stream.infoHash);
            return await CrispyNativeCore.resolveStream(stream.infoHash, stream.fileIdx ?? -1);
        }

        return null;
    }

    /**
     * Stops a torrent and cleans up.
     */
    static async stopTorrent(infoHash: string): Promise<void> {
        await CrispyNativeCore.stopTorrent(infoHash);
    }

    /**
     * Handles seeking for torrent piece prioritization.
     */
    static async handleSeek(infoHash: string, fileIdx: number, position: number): Promise<void> {
        await CrispyNativeCore.handleSeek(infoHash, fileIdx, position);
    }
}
