import { useState, useEffect, useContext } from 'react';
import { NearContext } from '@/wallets';
import { ProviderTracker } from '@/services/ProviderTracker';
import { PayoutStats, ProviderUsage } from '@/types/provider';

// Create singleton tracker instance
const tracker = new ProviderTracker();

export default function PayoutPanel() {
    const [stats, setStats] = useState<PayoutStats | null>(null);
    const [usages, setUsages] = useState<ProviderUsage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { wallet } = useContext(NearContext);

    const loadStats = async () => {
        const currentUsages = await tracker.getProviderUsages();
        setUsages(currentUsages);
        
        if (currentUsages.length > 0) {
            const stats = await tracker.getPayoutStats();
            setStats(stats);
        } else {
            setStats(null);
        }
    };

    useEffect(() => {
        loadStats(); // initial load
        const unsubscribe = tracker.subscribe(() => {
            loadStats(); // reload when data changes
        });
        return () => unsubscribe();
    }, []);

    const handlePayout = async () => {
        if (!usages.length) return;
        
        setIsLoading(true);
        try {
            const allScores = usages.flatMap(usage => 
                (usage.pendingScores || []).map(score => ({
                    providerId: usage.providerId,
                    relevancyScore: Math.floor(score * 100)
                }))
            );

            // Clear UI state immediately before transaction
            setStats(null);
            setUsages([]);
            await tracker.clearUsages();

            const batchSize = 100;
            for (let i = 0; i < allScores.length; i += batchSize) {
                const batch = allScores.slice(i, i + batchSize);
                await wallet.callMethod({
                    contractId: 'contract1.iseahorse.testnet',
                    method: 'process_query',
                    args: { queryResults: batch }
                });
            }
            
        } catch (error) {
            console.error('Error processing payout:', error);
            // Reload stats if transaction fails
            loadStats();
        } finally {
            setIsLoading(false);
        }
    };

    if (!stats) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-lg font-semibold mb-4">💰 Provider Payouts</h2>
                <div className="text-center text-gray-500">No payouts pending</div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold mb-4">💰 Provider Payouts</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">Providers</div>
                    <div className="text-2xl font-semibold">{stats.totalProviders}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">Total Uses</div>
                    <div className="text-2xl font-semibold">{stats.totalUsages}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">Avg Relevancy</div>
                    <div className="text-2xl font-semibold">
                        {(stats.averageRelevancy * 100).toFixed(1)}%
                    </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">Period</div>
                    <div className="text-sm font-medium">
                        {stats.periodStart.toLocaleDateString()} - {stats.periodEnd.toLocaleDateString()}
                    </div>
                </div>
            </div>

            <button
                onClick={handlePayout}
                disabled={isLoading || !usages.length}
                className={`w-full py-2 px-4 rounded-lg ${
                    isLoading || !usages.length
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
            >
                {isLoading ? 'Processing...' : 'Process Payouts'}
            </button>
        </div>
    );
} 