// @ts-nocheck
import localforage from 'localforage';

// Create singleton instance
let instance: ProviderTracker | null = null;

export class ProviderTracker {
    private store: LocalForage;
    private listeners: Set<() => void>;

    constructor() {
        if (instance) {
            return instance;
        }
        
        this.store = localforage.createInstance({
            name: 'provider-tracker'
        });
        this.listeners = new Set();
        instance = this;
    }

    async logProviderUsage(providerId: string, relevancyScore: number) {
        const usages = await this.getProviderUsages();
        const existing = usages.find(u => u.providerId === providerId);

        if (!existing) {
            usages.push({
                providerId,
                highestRelevancyScore: relevancyScore,
                usageCount: 1,
                lastUsed: new Date(),
                pendingScores: [relevancyScore]
            });
        } else {
            const timeSinceLastUse = new Date().getTime() - existing.lastUsed.getTime();
            const isNewQuery = timeSinceLastUse > 1000;

            if (isNewQuery) {
                if (!existing.pendingScores) {
                    existing.pendingScores = [];
                }
                existing.usageCount++;
                existing.lastUsed = new Date();
                existing.pendingScores.push(relevancyScore);
                
                if (relevancyScore > existing.highestRelevancyScore) {
                    existing.highestRelevancyScore = relevancyScore;
                }
            }
        }

        console.log('Storing provider usage:', {
            providerId,
            relevancyScore,
            usages
        });

        await this.store.setItem('provider_usages', usages);
        this.notifyListeners();
    }

    async getProviderUsages(): Promise<ProviderUsage[]> {
        const usages = await this.store.getItem('provider_usages') || [];
        console.log('Retrieved provider usages:', usages);
        return usages;
    }

    async getPayoutStats(): Promise<PayoutStats> {
        const usages = await this.getProviderUsages();
        const totalProviders = usages.length;
        const totalUsages = usages.reduce((sum, u) => sum + u.usageCount, 0);
        const averageRelevancy = usages.reduce((sum, u) => sum + u.highestRelevancyScore, 0) / totalProviders;

        return {
            totalProviders,
            totalUsages,
            averageRelevancy,
            periodStart: new Date(Math.min(...usages.map(u => u.lastUsed.getTime()))),
            periodEnd: new Date()
        };
    }

    async clearUsages() {
        try {
            // Clear storage
            await this.store.setItem('provider_usages', []);
            
            // Force immediate notification to all listeners
            setTimeout(() => this.notifyListeners(), 0);
            
            return true;
        } catch (error) {
            console.error('Error clearing usages:', error);
            return false;
        }
    }

    async clearProcessedScores(processedProviderIds: string[]) {
        const usages = await this.getProviderUsages();
        
        // filter out any providers that were processed
        const remainingUsages = usages.filter(usage => 
            !processedProviderIds.includes(usage.providerId)
        );

        await this.store.setItem('provider_usages', remainingUsages);
        this.notifyListeners();
    }

    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notifyListeners() {
        // Run synchronously to ensure immediate updates
        this.listeners.forEach(listener => {
            try {
                listener();
            } catch (error) {
                console.error('Error in provider tracker listener:', error);
            }
        });
    }
} 