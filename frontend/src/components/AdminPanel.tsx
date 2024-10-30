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
    const [activeTab, setActiveTab] = useState<'upload' | 'view'>('upload');
    const [selectedProvider, setSelectedProvider] = useState<string>('');
    const [csvContent, setCsvContent] = useState<string>('');
    const [providers, setProviders] = useState<Provider[]>([]);
    const [providerData, setProviderData] = useState<DataItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // initialize wallet
    useEffect(() => {
        const initWallet = async () => {
            const walletInstance = new Wallet({ 
                networkId: NetworkId, 
                createAccessKeyFor: 'contract1.iseahorse.testnet' 
            });
            
            // ensure wallet is initialized
            await walletInstance.startUp();
            setWallet(walletInstance);
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

    return (
        <>
            <motion.button
                onClick={() => setIsOpen(true)}
                className="w-full p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
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
                            className="bg-white rounded-xl p-6 w-[960px] max-h-[85vh] overflow-hidden shadow-xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                    Provider Data Management
                                </h2>
                                <motion.button 
                                    onClick={() => setIsOpen(false)}
                                    className="text-gray-500 hover:text-gray-700 p-1"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </motion.button>
                            </div>

                            <div className="flex gap-2 mb-6">
                                {['upload', 'view'].map((tab) => (
                                    <motion.button
                                        key={tab}
                                        onClick={() => setActiveTab(tab as 'upload' | 'view')}
                                        className={`px-6 py-2 rounded-lg relative ${
                                            activeTab === tab 
                                                ? 'text-white' 
                                                : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        {activeTab === tab && (
                                            <motion.div
                                                layoutId="activeTab"
                                                className="absolute inset-0 bg-blue-500 rounded-lg"
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

                            <div className="overflow-y-auto max-h-[65vh] pr-2 custom-scrollbar">
                                <AnimatePresence mode="wait">
                                    {activeTab === 'upload' ? (
                                        <motion.div
                                            key="upload"
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            className="space-y-4"
                                        >
                                            <div className="mb-4">
                                                <label className="block mb-2 text-gray-700">Provider ID:</label>
                                                <input 
                                                    type="text"
                                                    value={selectedProvider}
                                                    onChange={(e) => setSelectedProvider(e.target.value)}
                                                    placeholder="Enter provider ID"
                                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                                />
                                            </div>

                                            <div className="mb-4">
                                                <label className="block mb-2 text-gray-700">Upload CSV/TXT:</label>
                                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                                                    <input 
                                                        type="file" 
                                                        accept=".csv,.txt"
                                                        onChange={handleFileUpload}
                                                        className="hidden"
                                                        id="file-upload"
                                                    />
                                                    <label htmlFor="file-upload" className="cursor-pointer">
                                                        <div className="text-gray-500">
                                                            <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                            </svg>
                                                            <span className="text-blue-500 hover:text-blue-600">
                                                                Click to upload
                                                            </span>
                                                            {" or drag and drop"}
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
                                                    <div className="bg-gray-50 rounded-lg p-4 border">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <h3 className="font-medium text-gray-700">Preview:</h3>
                                                            <span className="text-sm text-gray-500">
                                                                {csvContent.split('\n').length - 1} items
                                                            </span>
                                                        </div>
                                                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                                            <table className="min-w-full divide-y divide-gray-200">
                                                                <tbody className="divide-y divide-gray-200">
                                                                    {csvContent.split('\n').map((line, index) => (
                                                                        <tr key={index} className={index === 0 ? 'bg-gray-100' : ''}>
                                                                            <td className={`py-2 text-sm ${
                                                                                index === 0 
                                                                                    ? 'font-semibold text-gray-700' 
                                                                                    : 'text-gray-600 font-mono'
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
                                                <label className="block mb-2">Provider ID:</label>
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="text"
                                                        value={selectedProvider}
                                                        onChange={(e) => setSelectedProvider(e.target.value)}
                                                        placeholder="Enter provider ID"
                                                        className="flex-1 p-2 border rounded"
                                                    />
                                                    <button
                                                        onClick={() => fetchProvider(selectedProvider)}
                                                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                                    >
                                                        View
                                                    </button>
                                                </div>
                                            </div>

                                            {isLoading ? (
                                                <div className="text-center py-4">Loading...</div>
                                            ) : (
                                                <>
                                                    {providers.map(provider => (
                                                        <div key={provider.id} className="mb-4 p-3 border rounded">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <h3 className="font-medium">{provider.name}</h3>
                                                                    <p className="text-sm text-gray-600">
                                                                        Value Score: {provider.valueScore}
                                                                    </p>
                                                                    <p className="text-sm text-gray-600">
                                                                        Wallet: {provider.walletAddress}
                                                                    </p>
                                                                </div>
                                                                <motion.button
                                                                    whileHover={{ scale: 1.05 }}
                                                                    whileTap={{ scale: 0.95 }}
                                                                    onClick={() => handleDeleteProvider(provider.id)}
                                                                    className="text-red-600 hover:text-red-900 text-sm px-3 py-1 rounded-lg hover:bg-red-50"
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
                                                            <div className="bg-gray-50 rounded-lg p-4 border">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <h3 className="font-medium text-gray-700">Provider Data:</h3>
                                                                    <span className="text-sm text-gray-500">
                                                                        {providerData.length} items
                                                                    </span>
                                                                </div>
                                                                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                                                    <table className="min-w-full divide-y divide-gray-200">
                                                                        <thead className="bg-gray-50 sticky top-0">
                                                                            <tr>
                                                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                                    ID
                                                                                </th>
                                                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                                    Content
                                                                                </th>
                                                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                                    Actions
                                                                                </th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="bg-white divide-y divide-gray-200">
                                                                            {providerData.map((item, index) => (
                                                                                <motion.tr 
                                                                                    key={item.id}
                                                                                    initial={{ opacity: 0, y: 20 }}
                                                                                    animate={{ opacity: 1, y: 0 }}
                                                                                    transition={{ delay: index * 0.05 }}
                                                                                    className="hover:bg-gray-50"
                                                                                >
                                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                                                                                        {item.id}
                                                                                    </td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-900">
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
                                                                                                <span className="text-blue-500 ml-2">
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
                                                                                            className="text-red-600 hover:text-red-900"
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

                            <div className="mt-6 flex justify-end gap-3">
                                <motion.button 
                                    onClick={() => setIsOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    Cancel
                                </motion.button>
                                <motion.button 
                                    onClick={handleUpload}
                                    disabled={!selectedProvider || !csvContent}
                                    className={`px-4 py-2 bg-blue-500 text-white rounded-lg
                                        ${(!selectedProvider || !csvContent) 
                                            ? 'opacity-50 cursor-not-allowed' 
                                            : 'hover:bg-blue-600'}`}
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