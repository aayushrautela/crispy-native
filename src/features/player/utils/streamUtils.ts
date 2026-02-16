export const LOCAL_STREAM_BASE = 'http://localhost:8090';

export const isMagnetUrl = (url?: string | null) =>
    typeof url === 'string' && url.toLowerCase().startsWith('magnet:');

export const isTorrentLikeStream = (stream?: { url?: string; infoHash?: string } | null) =>
    !!stream && (!!stream.infoHash || isMagnetUrl(stream.url));

export const normalizeLocalStreamUrl = (url: string) => {
    if (!url) return url;
    return url
        .replace('http://localhost:8090', LOCAL_STREAM_BASE)
        .replace('http://127.0.0.1:8090', LOCAL_STREAM_BASE);
};

export const isLocalStreamUrl = (url: string) => url.startsWith(LOCAL_STREAM_BASE);
