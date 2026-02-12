import { StorageService } from '../storage';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class AIService {
    private static isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }

    private static safeJsonParse(value: string): unknown {
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }

    private static extractErrorContext(errText: string): { searchText: string; retryAfterSeconds?: number } {
        let searchText = errText.toLowerCase();
        let retryAfterSeconds: number | undefined;

        const parsed = this.safeJsonParse(errText);
        if (!this.isRecord(parsed)) {
            return { searchText, retryAfterSeconds };
        }

        const errorNode = this.isRecord(parsed.error) ? parsed.error : null;
        if (!errorNode) {
            return { searchText, retryAfterSeconds };
        }

        if (typeof errorNode.message === 'string') {
            searchText += ` ${errorNode.message.toLowerCase()}`;
        }

        const metadata = this.isRecord(errorNode.metadata) ? errorNode.metadata : null;
        if (!metadata) {
            return { searchText, retryAfterSeconds };
        }

        if (typeof metadata.retry_after_seconds === 'number') {
            retryAfterSeconds = metadata.retry_after_seconds;
        }

        if (typeof metadata.raw !== 'string') {
            return { searchText, retryAfterSeconds };
        }

        searchText += ` ${metadata.raw.toLowerCase()}`;
        const providerError = this.safeJsonParse(metadata.raw);

        if (!this.isRecord(providerError)) {
            return { searchText, retryAfterSeconds };
        }

        const providerErrorNode = this.isRecord(providerError.error) ? providerError.error : null;
        if (!providerErrorNode) {
            return { searchText, retryAfterSeconds };
        }

        if (typeof providerErrorNode.message === 'string') {
            searchText += ` ${providerErrorNode.message.toLowerCase()}`;
        }

        if (typeof providerErrorNode.code === 'string') {
            searchText += ` ${providerErrorNode.code.toLowerCase()}`;
        }

        return { searchText, retryAfterSeconds };
    }

    private static buildFriendlyApiError(status: number, errText: string): string {
        const { searchText, retryAfterSeconds } = this.extractErrorContext(errText);
        const retryMessage = retryAfterSeconds
            ? ` Try again in about ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'}.`
            : ' Please try again in a moment.';

        if (
            status === 429
            || searchText.includes('rate limit')
            || searchText.includes('too many requests')
        ) {
            return `AI rate limited.${retryMessage}`;
        }

        if (
            status === 503
            || searchText.includes('throttl')
            || searchText.includes('capacity_error')
            || searchText.includes('server at capacity')
        ) {
            return `AI is currently throttled.${retryMessage}`;
        }

        if (status >= 500) {
            return `AI service is temporarily unavailable.${retryMessage}`;
        }

        return `AI insights are unavailable right now.${retryMessage}`;
    }

    static async getApiKey(): Promise<string | null> {
        return StorageService.getProfile<string>('crispy-openrouter-key') || process.env.EXPO_PUBLIC_OPENROUTER_KEY || null;
    }

    static async generateResponse(
        messages: { role: string; content: string }[],
        model: string = 'deepseek/deepseek-r1:free', // Defaulting to free R1
        options?: any
    ): Promise<any> {
        const apiKey = await this.getApiKey();

        if (!apiKey) {
            throw new Error('AI is not configured yet. Add an OpenRouter key in settings.');
        }

        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://crispy-app.com', // Required by OpenRouter
                    'X-Title': 'Crispy Native',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    messages,
                    ...options
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                const friendlyMessage = this.buildFriendlyApiError(response.status, errText);
                throw new Error(friendlyMessage);
            }

            const data = await response.json();
            return data.choices[0].message;
        } catch (error) {
            console.error('[AIService] Request failed:', error);

            if (error instanceof Error && /network request failed|failed to fetch|network/i.test(error.message)) {
                throw new Error('AI is unreachable right now. Check your connection and try again.');
            }

            if (error instanceof Error) {
                throw error;
            }

            throw new Error('AI insights are unavailable right now. Please try again in a moment.');
        }
    }
}
