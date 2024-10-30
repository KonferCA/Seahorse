type ProviderUsage = {
    providerId: string;
    highestRelevancyScore: number;
    usageCount: number;
    lastUsed: Date;
    pendingScores: number[]; // array of all scores to be paid out
};

type PayoutStats = {
    totalProviders: number;
    totalUsages: number;
    averageRelevancy: number;
    periodStart: Date;
    periodEnd: Date;
}; 