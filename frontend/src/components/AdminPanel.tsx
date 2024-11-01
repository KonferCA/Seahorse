// @ts-nocheck
import { useState, useEffect } from 'react';
import { Wallet } from '@/wallets';
import { NetworkId } from '@/config';
import { motion, AnimatePresence } from 'framer-motion';

interface Provider {
    id: string;
    name: string;
    valueScore: number;
    walletAddress: string;
}

interface DataItem {
    id: string;
    content: string;
}

export default function AdminPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'upload' | 'view' | 'create'>('upload');
    const [selectedProvider, setSelectedProvider] = useState<string>('');
    const [csvContent, setCsvContent] = useState<string>('');
    const [providers, setProviders] = useState<Provider[]>([]);
    const [providerData, setProviderData] = useState<DataItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [newProvider, setNewProvider] = useState({
        id: '',
        name: '',
        valueScore: 50,
        walletAddress: ''
    });
    const [allProviders, setAllProviders] = useState<Provider[]>([]);

    // initialize wallet
    useEffect(() => {
        const initWallet = async () => {
            const walletInstance = new Wallet({ 
                networkId: NetworkId, 
                createAccessKeyFor: 'contract1.iseahorse.testnet'
            });
            
            // add callback function for account changes
            await walletInstance.startUp((accountId: string) => {
                console.log('Account changed:', accountId);
            });
            
            setWallet(walletInstance);
            // Fetch providers when wallet is initialized
            fetchAllProviders();
        };

        initWallet();
    }, []);

    const fetchProviderData = async (providerId: string) => {
        if (!wallet) return;
        
        setIsLoading(true);
        try {
            const data = await wallet.viewMethod({
                contractId: 'contract1.iseahorse.testnet',
                method: 'get_provider_data',
                args: { providerId }
            });
            setProviderData(data || []);
        } catch (error) {
            console.error('Error fetching provider data:', error);
        }
        setIsLoading(false);
    };

    const fetchProvider = async (providerId: string) => {
        if (!wallet) return;

        try {
            const provider = await wallet.viewMethod({
                contractId: 'contract1.iseahorse.testnet',
                method: 'get_provider',
                args: { id: providerId }
            });
            if (provider) {
                setProviders([provider]);
                fetchProviderData(providerId);
            }
        } catch (error) {
            console.error('Error fetching provider:', error);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            setCsvContent(text);
        };
        reader.readAsText(file);
    };

    const handleUpload = async () => {
        if (!wallet) {
            console.error('Wallet not initialized');
            return;
        }

        if (!selectedProvider || !csvContent) return;

        try {
            const selector = await wallet.selector;
            if (!selector.isSignedIn()) {
                await wallet.signIn();
                return;
            }

            const lines = csvContent.split('\n');
            const data = lines
                .slice(1)
                .filter(line => line.trim())
                .map((line, index) => ({
                    id: `item_${index}`,
                    content: line.trim()
                }));

            await wallet.callMethod({
                contractId: 'contract1.iseahorse.testnet',
                method: 'add_provider_data',
                args: {
                    providerId: selectedProvider,
                    data
                }
            });
            
            alert('Data uploaded successfully!');
            setCsvContent('');
            setIsOpen(false);
        } catch (error) {
            console.error('Error uploading data:', error);
            alert('Error uploading data. Please ensure you are signed in.');
        }
    };

    const handleDelete = async (itemId: string) => {
        if (!wallet) {
            console.error('Wallet not initialized');
            return;
        }

        try {
            // ensure user is signed in
            const selector = await wallet.selector;
            if (!selector.isSignedIn()) {
                await wallet.signIn();
                return;
            }

            await wallet.callMethod({
                contractId: 'contract1.iseahorse.testnet',
                method: 'remove_provider_data',
                args: {
                    providerId: selectedProvider,
                    dataIds: [itemId]
                }
            });
            
            // refresh data after deletion
            await fetchProviderData(selectedProvider);
        } catch (error) {
            console.error('Error deleting item:', error);
            alert('Error deleting item. Please ensure you are signed in.');
        }
    };

    const truncateText = (text: string, maxLength: number) => {
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength) + '...';
    };

    // Add delete provider handler
    const handleDeleteProvider = async (providerId: string) => {
        if (!wallet) {
            console.error('Wallet not initialized');
            return;
        }

        if (window.confirm('Are you sure you want to delete this provider? This will delete all associated data and cannot be undone.')) {
            try {
                const selector = await wallet.selector;
                if (!selector.isSignedIn()) {
                    await wallet.signIn();
                    return;
                }

                await wallet.callMethod({
                    contractId: 'contract1.iseahorse.testnet',
                    method: 'remove_provider',
                    args: { id: providerId }
                });
                
                // Clear the current view
                setProviders([]);
                setProviderData([]);
                setSelectedProvider('');
                
                alert('Provider deleted successfully!');
            } catch (error) {
                console.error('Error deleting provider:', error);
                alert('Error deleting provider. Please ensure you are signed in.');
            }
        }
    };

    const handleCreateProvider = async () => {
        if (!wallet) {
            console.error('Wallet not initialized');
            return;
        }

        try {
            await wallet.callMethod({
                contractId: 'contract1.iseahorse.testnet',
                method: 'add_provider',
                args: newProvider
            });
            
            // reset form
            setNewProvider({
                id: '',
                name: '',
                valueScore: 50,
                walletAddress: ''
            });
            
            alert('Provider created successfully!');
            setActiveTab('view');
            fetchProvider(newProvider.id); // show the newly created provider
        } catch (error) {
            console.error('Error creating provider:', error);
            alert('Error creating provider. Please ensure all fields are valid.');
        }
    };

    const fetchAllProviders = async () => {
        if (!wallet) return;
        
        try {
            const providers = await wallet.viewMethod({
                contractId: 'contract1.iseahorse.testnet',
                method: 'get_all_providers',
                args: {}
            });
            setAllProviders(providers || []);
        } catch (error) {
            console.error('Error fetching providers:', error);
        }
    };

    // Add this effect to handle auto-refresh when switching to view tab
    useEffect(() => {
        if (activeTab === 'view') {
            fetchAllProviders();
        }
    }, [activeTab]);

    return (
        <>
            <motion.button
                onClick={() => setIsOpen(true)}
                className="w-full p-2 bg-[#22886c] text-white rounded-lg font-medium border-2 border-[#22886c] transition-colors hover:bg-[#1b6d56]"
            >
                Open Admin Panel
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#0f2c24] rounded-xl p-6 w-[960px] h-[800px] flex flex-col shadow-xl border-2 border-[#22886c]/20"
                        >
                            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                                <h2 className="text-2xl font-semibold text-white/90">
                                    Provider Data Management
                                </h2>
                                <motion.button 
                                    onClick={() => setIsOpen(false)}
                                    className="text-white/50 hover:text-white p-1"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </motion.button>
                            </div>

                            <div className="flex gap-2 mb-6 flex-shrink-0">
                                {['create', 'upload', 'view'].map((tab) => (
                                    <motion.button
                                        key={tab}
                                        onClick={() => setActiveTab(tab as 'upload' | 'view' | 'create')}
                                        className={`px-6 py-2 rounded-lg relative ${
                                            activeTab === tab 
                                                ? 'text-white' 
                                                : 'text-white/70 hover:bg-[#071b16]'
                                        }`}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        {activeTab === tab && (
                                            <motion.div
                                                layoutId="activeTab"
                                                className="absolute inset-0 bg-[#22886c] rounded-lg"
                                                initial={false}
                                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                            />
                                        )}
                                        <span className="relative z-10 capitalize">
                                            {tab}
                                        </span>
                                    </motion.button>
                                ))}
                            </div>

                            <div className="flex-1 overflow-hidden">
                                <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
                                    <AnimatePresence mode="wait">
                                        {activeTab === 'create' ? (
                                            <motion.div
                                                key="create"
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -20 }}
                                                className="space-y-4"
                                            >
                                                <div className="mb-4">
                                                    <label className="block mb-2 text-white/70">Provider ID:</label>
                                                    <input 
                                                        type="text"
                                                        value={newProvider.id}
                                                        onChange={(e) => setNewProvider(prev => ({ ...prev, id: e.target.value }))}
                                                        placeholder="Enter unique provider ID"
                                                        className="w-full p-3 bg-[#071b16] border border-[#22886c]/20 rounded-lg focus:ring-2 focus:ring-[#22886c] focus:border-[#22886c] outline-none transition-all text-white"
                                                    />
                                                </div>

                                                <div className="mb-4">
                                                    <label className="block mb-2 text-white/70">Provider Name:</label>
                                                    <input 
                                                        type="text"
                                                        value={newProvider.name}
                                                        onChange={(e) => setNewProvider(prev => ({ ...prev, name: e.target.value }))}
                                                        placeholder="Enter provider name"
                                                        className="w-full p-3 bg-[#071b16] border border-[#22886c]/20 rounded-lg focus:ring-2 focus:ring-[#22886c] focus:border-[#22886c] outline-none transition-all text-white"
                                                    />
                                                </div>

                                                <div className="mb-4">
                                                    <label className="block mb-2 text-white/70">Value Score (1-100):</label>
                                                    <div className="flex items-center gap-4">
                                                        <input 
                                                            type="range"
                                                            min="1"
                                                            max="100"
                                                            value={newProvider.valueScore}
                                                            onChange={(e) => setNewProvider(prev => ({ ...prev, valueScore: parseInt(e.target.value) }))}
                                                            className="flex-1 accent-[#22886c]"
                                                        />
                                                        <span className="w-12 text-center font-mono text-white">{newProvider.valueScore}</span>
                                                    </div>
                                                </div>

                                                <div className="mb-4">
                                                    <label className="block mb-2 text-white/70">Wallet Address:</label>
                                                    <input 
                                                        type="text"
                                                        value={newProvider.walletAddress}
                                                        onChange={(e) => setNewProvider(prev => ({ ...prev, walletAddress: e.target.value }))}
                                                        placeholder="Enter NEAR wallet address"
                                                        className="w-full p-3 bg-[#071b16] border border-[#22886c]/20 rounded-lg focus:ring-2 focus:ring-[#22886c] focus:border-[#22886c] outline-none transition-all text-white"
                                                    />
                                                </div>

                                                <div className="flex justify-end">
                                                    <motion.button
                                                        onClick={handleCreateProvider}
                                                        disabled={!newProvider.id || !newProvider.name || !newProvider.walletAddress}
                                                        className={`px-4 py-2 bg-[#22886c] text-white rounded-lg hover:bg-[#1b6d56] disabled:opacity-50 disabled:cursor-not-allowed`}
                                                        whileHover={(!newProvider.id || !newProvider.name || !newProvider.walletAddress) ? {} : { scale: 1.02 }}
                                                        whileTap={(!newProvider.id || !newProvider.name || !newProvider.walletAddress) ? {} : { scale: 0.98 }}
                                                    >
                                                        Create Provider
                                                    </motion.button>
                                                </div>
                                            </motion.div>
                                        ) : activeTab === 'upload' ? (
                                            <motion.div
                                                key="upload"
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -20 }}
                                                className="space-y-4"
                                            >
                                                <div className="mb-4">
                                                    <label className="block mb-2 text-white/70">Provider:</label>
                                                    <div className="flex gap-2">
                                                        <select
                                                            value={selectedProvider}
                                                            onChange={(e) => {
                                                                setSelectedProvider(e.target.value);
                                                                if (e.target.value) {
                                                                    fetchProvider(e.target.value);
                                                                }
                                                            }}
                                                            className="flex-1 p-3 bg-[#071b16] border border-[#22886c]/20 rounded-lg focus:ring-2 focus:ring-[#22886c] focus:border-[#22886c] outline-none transition-all text-white"
                                                        >
                                                            <option value="" className="text-white">Select a provider</option>
                                                            {allProviders.map(provider => (
                                                                <option key={provider.id} value={provider.id} className="text-white">
                                                                    {provider.name} ({provider.id})
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <motion.button
                                                            onClick={fetchAllProviders}
                                                            className="px-3 py-2 bg-[#071b16] hover:bg-[#0f2c24] text-white/70 hover:text-white rounded-lg border border-[#22886c]/20"
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                            </svg>
                                                        </motion.button>
                                                    </div>
                                                </div>

                                                <div className="mb-4">
                                                    <label className="block mb-2 text-white/70">Upload CSV/TXT:</label>
                                                    <div className="border-2 border-dashed border-[#22886c]/20 rounded-lg p-8 text-center hover:border-[#22886c]/40 transition-colors">
                                                        <input 
                                                            type="file" 
                                                            accept=".csv,.txt"
                                                            onChange={handleFileUpload}
                                                            className="hidden"
                                                            id="file-upload"
                                                        />
                                                        <label htmlFor="file-upload" className="cursor-pointer">
                                                            <div className="text-white/70">
                                                                <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                                </svg>
                                                                <span className="text-[#22886c] hover:text-[#1b6d56]">
                                                                    Click to upload
                                                                </span>
                                                                <span className="text-white/70"> or drag and drop</span>
                                                            </div>
                                                        </label>
                                                    </div>
                                                </div>

                                                {csvContent && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        className="mt-6"
                                                    >
                                                        <div className="bg-[#071b16] rounded-lg p-4 border border-[#22886c]/20">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <h3 className="font-medium text-white">Preview:</h3>
                                                                <span className="text-sm text-white/50">
                                                                    {csvContent.split('\n').length - 1} items
                                                                </span>
                                                            </div>
                                                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                                                <table className="min-w-full divide-y divide-[#22886c]/20">
                                                                    <tbody className="divide-y divide-[#22886c]/20">
                                                                        {csvContent.split('\n').map((line, index) => (
                                                                            <tr key={index} className={index === 0 ? 'bg-[#0f2c24]' : ''}>
                                                                                <td className={`py-2 text-sm ${
                                                                                    index === 0 
                                                                                        ? 'font-semibold text-white' 
                                                                                        : 'text-white/70 font-mono'
                                                                                }`}>
                                                                                    {line}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="view"
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -20 }}
                                            >
                                                <div className="mb-4">
                                                    <label className="block mb-2 text-white/70">Provider:</label>
                                                    <div className="flex gap-2">
                                                        <select
                                                            value={selectedProvider}
                                                            onChange={(e) => {
                                                                setSelectedProvider(e.target.value);
                                                                if (e.target.value) {
                                                                    fetchProvider(e.target.value);
                                                                }
                                                            }}
                                                            className="flex-1 p-3 bg-[#071b16] border border-[#22886c]/20 rounded-lg focus:ring-2 focus:ring-[#22886c] focus:border-[#22886c] outline-none transition-all text-white"
                                                        >
                                                            <option value="" className="text-white">Select a provider</option>
                                                            {allProviders.map(provider => (
                                                                <option key={provider.id} value={provider.id} className="text-white">
                                                                    {provider.name} ({provider.id})
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <motion.button
                                                            onClick={fetchAllProviders}
                                                            className="px-3 py-2 bg-[#071b16] hover:bg-[#0f2c24] text-white/70 hover:text-white rounded-lg border border-[#22886c]/20"
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                            </svg>
                                                        </motion.button>
                                                    </div>
                                                </div>

                                                {isLoading ? (
                                                    <div className="text-center py-4 text-white/70">Loading...</div>
                                                ) : (
                                                    <>
                                                        {providers.map(provider => (
                                                            <div key={provider.id} className="mb-4 p-3 border border-[#22886c]/20 bg-[#071b16] rounded-lg">
                                                                <div className="flex justify-between items-start">
                                                                    <div>
                                                                        <h3 className="font-medium text-white">{provider.name}</h3>
                                                                        <p className="text-sm text-white/70">
                                                                            Value Score: {provider.valueScore}
                                                                        </p>
                                                                        <p className="text-sm text-white/70">
                                                                            Wallet: {provider.walletAddress}
                                                                        </p>
                                                                    </div>
                                                                    <motion.button
                                                                        whileHover={{ scale: 1.05 }}
                                                                        whileTap={{ scale: 0.95 }}
                                                                        onClick={() => handleDeleteProvider(provider.id)}
                                                                        className="text-red-400 hover:text-red-300 text-sm px-3 py-1 rounded-lg hover:bg-red-900/20"
                                                                    >
                                                                        Delete Provider
                                                                    </motion.button>
                                                                </div>
                                                            </div>
                                                        ))}

                                                        {providerData.length > 0 && (
                                                            <motion.div
                                                                initial={{ opacity: 0, height: 0 }}
                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                className="mt-4"
                                                            >
                                                                <div className="bg-[#071b16] rounded-lg p-4 border border-[#22886c]/20">
                                                                    <div className="flex justify-between items-center mb-2">
                                                                        <h3 className="font-medium text-white/90">Provider Data:</h3>
                                                                        <span className="text-sm text-white/50">
                                                                            {providerData.length} items
                                                                        </span>
                                                                    </div>
                                                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                                                        <table className="min-w-full divide-y divide-[#22886c]/20">
                                                                            <thead className="bg-[#071b16] sticky top-0">
                                                                                <tr>
                                                                                    <th className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">
                                                                                        ID
                                                                                    </th>
                                                                                    <th className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">
                                                                                        Content
                                                                                    </th>
                                                                                    <th className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">
                                                                                        Actions
                                                                                    </th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-[#22886c]/20">
                                                                                {providerData.map((item, index) => (
                                                                                    <motion.tr 
                                                                                        key={item.id}
                                                                                        initial={{ opacity: 0, y: 20 }}
                                                                                        animate={{ opacity: 1, y: 0 }}
                                                                                        transition={{ delay: index * 0.05 }}
                                                                                        className="hover:bg-[#0f2c24]"
                                                                                    >
                                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-white/90">
                                                                                            {item.id}
                                                                                        </td>
                                                                                        <td className="px-6 py-4 text-sm text-white/90">
                                                                                            <div 
                                                                                                className="cursor-pointer"
                                                                                                onClick={() => {
                                                                                                    setExpandedRows(prev => {
                                                                                                        const newSet = new Set(prev);
                                                                                                        if (newSet.has(item.id)) {
                                                                                                            newSet.delete(item.id);
                                                                                                        } else {
                                                                                                            newSet.add(item.id);
                                                                                                        }
                                                                                                        return newSet;
                                                                                                    });
                                                                                                }}
                                                                                            >
                                                                                                {expandedRows.has(item.id) 
                                                                                                    ? item.content
                                                                                                    : truncateText(item.content, 80)}
                                                                                                {item.content.length > 80 && (
                                                                                                    <span className="text-[#22886c] hover:text-[#1b6d56] ml-2">
                                                                                                        {expandedRows.has(item.id) ? 'Show less' : 'Show more'}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                                                            <motion.button
                                                                                                whileHover={{ scale: 1.05 }}
                                                                                                whileTap={{ scale: 0.95 }}
                                                                                                onClick={() => handleDelete(item.id)}
                                                                                                className="text-red-400 hover:text-red-300"
                                                                                            >
                                                                                                Delete
                                                                                            </motion.button>
                                                                                        </td>
                                                                                    </motion.tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end gap-3 flex-shrink-0">
                                <motion.button 
                                    onClick={() => setIsOpen(false)}
                                    className="px-4 py-2 text-white/70 hover:bg-[#071b16] rounded-lg"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    Cancel
                                </motion.button>
                                <motion.button 
                                    onClick={handleUpload}
                                    disabled={!selectedProvider || !csvContent}
                                    className={`px-4 py-2 bg-[#22886c] text-white rounded-lg hover:bg-[#1b6d56] disabled:opacity-50 disabled:cursor-not-allowed`}
                                    whileHover={(!selectedProvider || !csvContent) ? {} : { scale: 1.02 }}
                                    whileTap={(!selectedProvider || !csvContent) ? {} : { scale: 0.98 }}
                                >
                                    Upload Data
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
} 