export interface SubtitleSegment {
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
}

export interface SubtitleCue {
    start: number;
    end: number;
    text: string;
    rawText?: string;
    segments?: SubtitleSegment[];
}
