import { useState, useEffect, useContext } from 'react';
import { NearContext } from '@/wallets';
import { ProviderTracker } from '@/services/ProviderTracker';
import { PayoutStats, ProviderUsage } from '@/types/provider';

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
        loadStats();
        const unsubscribe = tracker.subscribe(() => {
            loadStats();
        });
        return () => unsubscribe();
    }, []);

    const handlePayout = async () => {
        if (!usages.length) return;
        
        setIsLoading(true);
        try {
            const allScores = usages.flatMap(usage => 
                (usage.pendingScores || []).map((score: number) => ({
                    providerId: usage.providerId,
                    relevancyScore: Math.floor(score * 100)
                }))
            );

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
            loadStats();
        } finally {
            setIsLoading(false);
        }
    };

    if (!stats) {
        return (
            <div className="bg-[#0f2c24] rounded-lg p-6 border-2 border-[#22886c]/20">
                <h2 className="text-lg font-semibold mb-4 text-white">💰 Provider Payouts</h2>
                <div className="text-center text-white/50">No payouts pending</div>
            </div>
        );
    }

    return (
        <div className="bg-[#0f2c24] rounded-lg p-6 border-2 border-[#22886c]/20">
            <h2 className="text-lg font-semibold mb-4 text-white">💰 Provider Payouts</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-[#071b16] rounded-lg border border-[#22886c]/20">
                    <div className="text-sm text-white/50">Providers</div>
                    <div className="text-2xl font-semibold text-white">{stats.totalProviders}</div>
                </div>
                <div className="p-4 bg-[#071b16] rounded-lg border border-[#22886c]/20">
                    <div className="text-sm text-white/50">Total Uses</div>
                    <div className="text-2xl font-semibold text-white">{stats.totalUsages}</div>
                </div>
                <div className="p-4 bg-[#071b16] rounded-lg border border-[#22886c]/20">
                    <div className="text-sm text-white/50">Avg Relevancy</div>
                    <div className="text-2xl font-semibold text-white">
                        {(stats.averageRelevancy * 100).toFixed(1)}%
                    </div>
                </div>
                <div className="p-4 bg-[#071b16] rounded-lg border border-[#22886c]/20">
                    <div className="text-sm text-white/50">Period</div>
                    <div className="text-sm font-medium text-white">
                        {stats.periodStart.toLocaleDateString()} - {stats.periodEnd.toLocaleDateString()}
                    </div>
                </div>
            </div>

            <button
                onClick={handlePayout}
                disabled={isLoading || !usages.length}
                className={`w-full py-2 px-4 rounded-lg border-2 transition-colors ${
                    isLoading || !usages.length
                        ? 'bg-[#071b16] text-white/50 border-[#22886c]/20 cursor-not-allowed'
                        : 'bg-[#22886c] border-[#22886c] text-white'
                }`}
            >
                {isLoading ? 'Processing...' : 'Process Payouts'}
            </button>
        </div>
    );
};