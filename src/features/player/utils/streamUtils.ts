export const LOCAL_STREAM_BASE = 'http://127.0.0.1:11470';

export const normalizeLocalStreamUrl = (url: string) => {
    if (!url) return url;
    return url
        .replace('http://localhost:11470', LOCAL_STREAM_BASE)
        .replace('http://127.0.0.1:11470', LOCAL_STREAM_BASE);
};

export const isLocalStreamUrl = (url: string) => url.startsWith(LOCAL_STREAM_BASE);
