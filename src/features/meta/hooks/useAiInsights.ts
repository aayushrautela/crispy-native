import { useCallback, useState } from 'react';
import { AIService } from '../../../core/services/AIService';
import { StorageService } from '../../../core/storage';
import { useUserStore } from '@/src/features/trakt/stores/userStore';

export interface InsightCard {
    type: 'consensus' | 'performance' | 'theme' | 'vibe' | 'style' | 'performance_actor' | 'controversy' | 'character';
    title: string;
    category: string;
    content: string;
}

export interface AiInsightsResult {
    insights: InsightCard[];
    trivia: string;
}

const CACHE_PREFIX = 'ai_ins_';

export function useAiInsights() {
    const { settings } = useUserStore();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [insights, setInsights] = useState<AiInsightsResult | null>(null);

    const loadFromCache = useCallback(async (id: string) => {
        if (!id) return false;
        const cached = StorageService.getUser<AiInsightsResult>(`${CACHE_PREFIX}${id}`);
        if (cached) {
            setInsights(cached);
            return true;
        }
        return false;
    }, []);

    const generateInsights = useCallback(async (meta: any, reviews: any[] = []) => {
        if (!meta) return;

        setIsLoading(true);
        setError(null);

        // Check cache first
        const cacheKey = `${CACHE_PREFIX}${meta.tmdbId || meta.id}`;
        const cached = StorageService.getUser<AiInsightsResult>(cacheKey);
        if (cached) {
            setInsights(cached);
            setIsLoading(false);
            return;
        }

        // Determine model
        const MODELS: Record<string, string> = {
            'deepseek-r1': 'deepseek/deepseek-r1:free',
            'nvidia-nemotron': 'nvidia/nemotron-3-nano-30b-a3b:free'
        };

        let model = MODELS['deepseek-r1'];
        if (settings.aiModelType === 'custom' && settings.aiCustomModelName) {
            model = settings.aiCustomModelName;
        } else if (settings.aiModelType === 'nvidia-nemotron') {
            model = MODELS['nvidia-nemotron'];
        }

        const hasReviews = reviews && reviews.length > 0;
        const context = {
            title: meta.title || meta.name,
            year: meta.year || meta.releaseInfo?.split('-')[0],
            description: meta.description,
            rating: meta.rating,
            genres: meta.genres,
            reviews: hasReviews
                ? reviews.slice(0, 10).map(r => `(Likes: ${r.likes || 0}) "${r.comment?.slice(0, 500) || r.content?.slice(0, 500)}..."`).join('\n---\n')
                : "No user reviews available."
        };

        const prompt = `
Analyze the following movie/show data ${hasReviews ? 'and user reviews' : ''} to generate engaging insights.
Be a film enthusiast, not a critic. Use simple, conversational, and exciting English.
Avoid complex words, academic jargon, or flowery prose. Write like you're talking to a friend.
If reviews are provided, give more weight to opinions with higher 'Like' counts or ratings, but consider all perspectives.
Do NOT use generic headings.

Context:
Title: ${context.title} (${context.year})
Plot: ${context.description}
Rating: ${context.rating}
Genres: ${context.genres?.join(', ')}

${hasReviews ? `User Reviews:\n${context.reviews}` : 'Note: No user reviews provided, generate insights based on plot/metadata.'}

Task:
Generate a JSON object with:
1. "insights": Array of 3 objects, each with:
   - "category": Short uppercase label (e.g., "CRITICAL CONSENSUS", "VISUAL STYLE").
   - "title": Punchy, short headline.
   - "content": 1-2 sentence description.
   - "type": One of ["consensus", "performance", "theme", "vibe", "style", "controversy", "character"].
2. "trivia": A single interesting "Did you know?" fact.

Return ONLY valid JSON.
`;

        try {
            const response = await AIService.generateResponse([
                { role: 'user', content: prompt }
            ], model, {
                response_format: { type: 'json_object' }
            });

            if (response && response.content) {
                let jsonString = response.content;
                const jsonMatch = response.content.match(/\{[\s\S]*\}/);
                if (jsonMatch) jsonString = jsonMatch[0];
                else jsonString = response.content.replace(/```json\n|\n```/g, '').trim();

                const data = JSON.parse(jsonString);
                setInsights(data);
                StorageService.setUser(cacheKey, data);
            }
        } catch (e) {
            console.error('Failed to generate insights:', e);
            setError(e instanceof Error ? e : new Error('Unknown AI Error'));
        } finally {
            setIsLoading(false);
        }
    }, [settings.aiModelType, settings.aiCustomModelName]);

    const clearInsights = useCallback(() => {
        setInsights(null);
        setError(null);
    }, []);

    return {
        generateInsights,
        loadFromCache,
        clearInsights,
        insights,
        isLoading,
        error
    };
}
