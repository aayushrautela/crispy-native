import { StorageService } from '../storage';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class AIService {
    static async getApiKey(): Promise<string | null> {
        return process.env.EXPO_PUBLIC_OPENROUTER_KEY || StorageService.getUser<string>('crispy-openrouter-key');
    }

    static async setApiKey(key: string) {
        return StorageService.setUser('crispy-openrouter-key', key);
    }

    static async generateResponse(
        messages: { role: string; content: string }[],
        model: string = 'deepseek/deepseek-r1:free', // Defaulting to free R1
        options?: any
    ): Promise<any> {
        const apiKey = await this.getApiKey();

        if (!apiKey) {
            throw new Error('OPENROUTER_KEY_MISSING');
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
                throw new Error(`OpenRouter API Error (${response.status}): ${errText}`);
            }

            const data = await response.json();
            return data.choices[0].message;
        } catch (error) {
            console.error('[AIService] Request failed:', error);
            throw error;
        }
    }
}
