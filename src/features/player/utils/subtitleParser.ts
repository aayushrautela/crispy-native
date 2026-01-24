import { SubtitleCue, SubtitleSegment } from './playerTypes';

/**
 * Detect subtitle format from content
 */
export function detectSubtitleFormat(content: string, url?: string): 'srt' | 'vtt' | 'unknown' {
    if (url) {
        const urlLower = url.toLowerCase();
        if (urlLower.includes('.srt')) return 'srt';
        if (urlLower.includes('.vtt')) return 'vtt';
    }

    const first100Chars = content.trim().substring(0, 100);
    if (first100Chars.includes('WEBVTT') || first100Chars.match(/\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}/)) {
        return 'vtt';
    }
    if (first100Chars.match(/\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{3}/)) {
        return 'srt';
    }
    return 'srt';
}

/**
 * Parse SRT timestamp to seconds
 */
function parseSRTTimestamp(timestamp: string): number {
    const match = timestamp.match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!match) return 0;
    return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 1000;
}

/**
 * Parse HTML-style formatting tags
 */
function parseSubtitleFormatting(text: string): SubtitleSegment[] {
    // Simple implementation for now, mirroring Nuvio's logic
    // Just strip tags for plain text display in this version if needed, 
    // or return the raw text if we want to handle tags in the UI.
    return [{ text: text.replace(/<[^>]*>/g, '') }];
}

/**
 * Parse SRT format
 */
export function parseSRT(content: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    if (!content) return cues;

    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const blocks = normalized.split(/\n\s*\n/);

    for (const block of blocks) {
        const lines = block.split('\n').map(l => l.trim());
        if (lines.length < 2) continue;

        let timeLineIndex = -1;
        let timeMatch = null;

        for (let j = 0; j < Math.min(3, lines.length); j++) {
            timeMatch = lines[j].match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/);
            if (timeMatch) {
                timeLineIndex = j;
                break;
            }
        }

        if (!timeMatch || timeLineIndex === -1) continue;

        const startTime = parseSRTTimestamp(lines[timeLineIndex]);
        const endTime = parseSRTTimestamp(lines[timeLineIndex].split(' --> ')[1]);
        const text = lines.slice(timeLineIndex + 1).join('\n');

        cues.push({
            start: startTime,
            end: endTime,
            text: text.replace(/<[^>]*>/g, ''), // Plain text for now
            rawText: text
        });
    }
    return cues;
}

/**
 * Parse WebVTT format
 */
export function parseWebVTT(content: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    if (!content) return cues;

    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');

    let skipHeader = true;
    let currentBlock: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (skipHeader) {
            if (line.startsWith('WEBVTT')) skipHeader = false;
            continue;
        }

        if (line === '') {
            if (currentBlock.length >= 2) {
                const timeMatch = currentBlock[0].match(/(\d{1,2}):(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(\d{1,2}):(\d{2}):(\d{2})\.(\d{3})/);
                if (timeMatch) {
                    const start = parseVTTTimestamp(timeMatch[0].split(' --> ')[0]);
                    const end = parseVTTTimestamp(timeMatch[0].split(' --> ')[1].split(' ')[0]);
                    const text = currentBlock.slice(1).join('\n');
                    cues.push({
                        start,
                        end,
                        text: text.replace(/<[^>]*>/g, ''),
                        rawText: text
                    });
                }
            }
            currentBlock = [];
        } else {
            currentBlock.push(line);
        }
    }
    return cues;
}

function parseVTTTimestamp(timestamp: string): number {
    const match = timestamp.match(/(\d{1,2}):(\d{2}):(\d{2})\.(\d{3})/);
    if (!match) return 0;
    return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 1000;
}

export function parseSubtitle(content: string, url?: string): SubtitleCue[] {
    const format = detectSubtitleFormat(content, url);
    return format === 'vtt' ? parseWebVTT(content) : parseSRT(content);
}
