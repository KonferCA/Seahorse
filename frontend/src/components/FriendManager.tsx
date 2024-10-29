import { useEffect, useState, useContext } from 'react';
import { EncryptionManager } from '../utils/encryption';
import { NearContext } from '@wallets';
import FriendCalendar from './FriendCalendar';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_NAME || 'iseehorses.testnet';

export default function FriendManager() {
  const { wallet } = useContext(NearContext);
  const [friendId, setFriendId] = useState('');
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [friends, setFriends] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [friendsData, setFriendsData] = useState<{[key: string]: any}>({});
  const [encryptionManager, setEncryptionManager] = useState(() => new EncryptionManager(wallet));
  const [message, setMessage] = useState('');
  const [receivedMessages, setReceivedMessages] = useState<{[key: string]: string}>({});
  const [messageText, setMessageText] = useState('');

  // Initialize encryption manager when component mounts
  useEffect(() => {
    const initializeEncryption = async () => {
      await encryptionManager.initialize();
      await encryptionManager.loadStoredKeys();
      console.log('Encryption manager initialized with keys:', 
        Array.from(encryptionManager.getStoredKeyIds()));
    };
    initializeEncryption();
  }, []);

  useEffect(() => {
    if (wallet) {
      console.log('Initial load of friend data...');
      const loadInitialData = async () => {
        await refreshFriendLists();
        await loadFriendsData();
      };
      loadInitialData();
    }
  }, [wallet]);

  // Separate useEffect for friends changes
  useEffect(() => {
    console.log('Friends list changed:', friends);
    if (friends.length > 0) {
        loadFriendsData();
    }
}, [friends]);

  const checkPendingRequests = async () => {
    const accountId = await wallet.selector.then(selector => 
      selector.store.getState().accounts[0]?.accountId
    );
    
    console.log('Checking pending requests for', accountId);
    if (!accountId) return;
    
    try {
      setIsLoading(true);
      const requests = await wallet.viewMethod({
        contractId: CONTRACT_ADDRESS,
        method: 'get_pending_friend_requests',
        args: { accountId }
      });
      
      console.log('Received pending requests:', requests);
      setPendingRequests(requests);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendFriendRequest = async (friendId: string) => {
    try {
      setIsLoading(true);
      
      // Generate keys and encrypt
      const { publicKey, encryptedKey } = await encryptionManager.initiateFriendRequest(friendId);
      
      // Send request with our public key and encrypted symmetric key
      await wallet.callMethod({
        contractId: CONTRACT_ADDRESS,
        method: 'send_friend_request',
        args: { 
          friend_id: friendId,
          public_key: publicKey,
          encrypted_key: encryptedKey
        }
      });
      
      // Test encryption
      const testMessage = { test: true, timestamp: Date.now() };
      const encrypted = await encryptionManager.encryptData(testMessage, friendId);
      console.log('Test encryption successful:', encrypted);
      
      await refreshFriendLists();
    } catch (error) {
      console.error('Error sending friend request:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptFriend = async (request: FriendRequest) => {
    try {
      setIsLoading(true);
      console.log('Accepting friend request from:', request.from);

      // 1. Generate new symmetric key
      const symmetricKey = await encryptionManager.generateSymmetricKey();
      
      // 2. Store it locally first
      await encryptionManager.storeBidirectionalKey(request.from, symmetricKey);
      
      // 3. Import their public key and encrypt our symmetric key
      const theirPublicKey = await encryptionManager.importPublicKey(request.publicKey);
      const encryptedKey = await encryptionManager.encryptKeyForFriend(symmetricKey, theirPublicKey);
      
      // 4. Export our public key
      const ourPublicKey = await encryptionManager.exportPublicKey();
      
      // 5. Now verify our key works locally
      const verified = await encryptionManager.verifyKeyExchange(request.from);
      if (!verified) {
        throw new Error('Key exchange verification failed');
      }

      // 6. If verified, accept the friend request
      await wallet.callMethod({
        contractId: CONTRACT_ADDRESS,
        method: 'accept_friend_request',
        args: { 
          from: request.from,
          public_key: ourPublicKey,
          encrypted_key: encryptedKey
        }
      });

      // 7. Refresh UI
      await refreshFriendLists();
      await checkPendingRequests();

      console.log('Friend request accepted successfully');
    } catch (error) {
      console.error('Error accepting friend:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshFriendLists = async () => {
    console.log('Refreshing friend lists...');
    const accountId = await wallet.selector.then(selector => 
      selector.store.getState().accounts[0]?.accountId
    );
    
    if (!accountId) return;
    
    try {
      setIsLoading(true);
      const [friendsList, outgoing] = await Promise.all([
        wallet.viewMethod({
          contractId: CONTRACT_ADDRESS,
          method: 'get_friends',
          args: { accountId }
        }),
        wallet.viewMethod({
          contractId: CONTRACT_ADDRESS,
          method: 'get_outgoing_requests',
          args: { accountId }
        })
      ]);
      
      setFriends(friendsList);
      setOutgoingRequests(outgoing);
    } catch (error) {
      console.error('Error fetching friend lists:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const removeFriend = async (friendId: string) => {
    try {
      setIsLoading(true);
      await wallet.callMethod({
        contractId: CONTRACT_ADDRESS,
        method: 'remove_friend',
        args: { friendId }
      });

      await refreshFriendLists();
    } catch (error) {
      console.error('Error removing friend:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleData = async (calendar: any, emails: any) => {
    // use existing instance from state
    await encryptionManager.loadStoredKeys();

    // ensure we have exchanged keys first
    if (!encryptionManager.getStoredKeyIds().includes(friendId)) {
      throw new Error('Please complete key exchange with friend before sharing data');
    }

    const data = {
      calendar,
      emails
    };

    const encryptedData = await encryptionManager.encryptData(data, friendId);

    // store encrypted data on chain
    await wallet.callMethod({
      contractId: CONTRACT_ADDRESS,
      method: 'store_encrypted_data',
      args: { encryptedData }
    });
  };

  const loadFriendsData = async () => {
    console.log('Loading friends data...');
    for (const friendId of friends) {
      try {
        console.log('Processing friend:', friendId);
        
        // Get encrypted data from contract
        const encryptedData = await wallet.viewMethod({
          contractId: CONTRACT_ADDRESS,
          method: 'get_friend_data',
          args: { friendId }
        });

        console.log('Raw data from contract:', { friendId, encryptedData });

        if (!encryptedData) {
          console.log('No data found for:', friendId);
          continue;
        }

        // Validate data format
        if (typeof encryptedData !== 'string') {
          console.log('Invalid data format for:', friendId);
          continue;
        }

        console.log('Analyzing data for', friendId);
        const analyzedData = await encryptionManager?.decryptData(encryptedData, friendId);
        
        if (analyzedData) {
          console.log('Successfully decrypted data for:', friendId, analyzedData);
          setFriendsData(prev => ({
            ...prev,
            [friendId]: analyzedData
          }));
        }
      } catch (error) {
        console.log('Failed to process friend data:', friendId, error);
      }
    }
  };

  const clearAllFriendData = async () => {
    try {
      setIsLoading(true);
      await wallet.callMethod({
        contractId: CONTRACT_ADDRESS,
        method: 'clear_all_friend_data',
        args: {}
      });
      
      // refresh lists after clearing
      await refreshFriendLists();
      await checkPendingRequests();
      console.log('Cleared all friend data from contract');
    } catch (error) {
      console.error('Error clearing friend data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearLocalKeys = () => {
    try {
      localStorage.removeItem('symmetricKeys');
      setEncryptionManager(new EncryptionManager(wallet));
      console.log('Cleared all local encryption keys');
    } catch (error) {
      console.error('Error clearing local keys:', error);
    }
  };

  const verifyKeyExchange = async (friendId: string) => {
    const encryptionManager = new EncryptionManager();
    await encryptionManager.initialize();
    await encryptionManager.loadStoredKeys();
    
    // check if we have the key
    const hasKey = encryptionManager.getStoredKeyIds().includes(friendId);
    if (!hasKey) {
        console.error('no stored key found for:', friendId);
        return false;
    }
    
    // test encryption/decryption
    try {
        const testData = { test: 'verification' };
        console.log('testing key with friend:', friendId);
        
        // try a test encryption/decryption cycle
        const encrypted = await encryptionManager.encryptData(testData, friendId);
        const decrypted = await encryptionManager.decryptData(encrypted, friendId);
        
        const success = JSON.stringify(testData) === JSON.stringify(decrypted);
        console.log('key verification:', success ? 'successful' : 'failed');
        
        if (!success) {
            console.log('test data:', testData);
            console.log('decrypted result:', decrypted);
        }
        
        return success;
    } catch (error) {
        console.error('key verification failed:', error);
        return false;
    }
};

  const sendMessage = async (friendId: string) => {
    try {
      // get existing data first
      const existingData = friendsData[friendId] || {};
      
      // update with new message
      const newData = {
        ...existingData,
        messages: [...(existingData.messages || []), {
          text: message,
          timestamp: new Date().toISOString()
        }]
      };

      // encrypt and send
      const encrypted = await encryptionManager.encryptData(newData, friendId);
      await wallet.callMethod({
        contractId: CONTRACT_ADDRESS,
        method: 'store_encrypted_data',
        args: { encryptedData: encrypted }
      });
      
      setMessage(''); // clear input
      console.log('Message sent successfully');
      
      // refresh data to see new message
      await loadFriendsData();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const renderFriendMessage = (friendId: string) => {
    return (
      <div className="mt-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="border p-1 mr-2"
        />
        <button 
          onClick={() => sendMessage(friendId)}
          className="bg-blue-500 text-white px-2 py-1 rounded"
        >
          Send
        </button>
        {receivedMessages[friendId] && (
          <div className="mt-2">
            <strong>Last message:</strong> {receivedMessages[friendId]}
          </div>
        )}
      </div>
    );
  };

  const analyzeEncryptedData = (encryptedData: string) => {
    try {
        const decoded = atob(encryptedData);
        console.log('Encrypted data analysis:');
        console.log('- Base64 length:', encryptedData.length);
        console.log('- Decoded length:', decoded.length);
        console.log('- First few bytes:', Array.from(new Uint8Array(decoded.slice(0, 20).split('').map(c => c.charCodeAt(0)))));
        return true;
    } catch (e) {
        console.error('Data analysis failed:', e);
        return false;
    }
};

  const analyzeStoredData = (encryptedData: string) => {
    try {
        const decoded = atob(encryptedData);
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
            bytes[i] = decoded.charCodeAt(i);
        }

        console.log('Stored data analysis:');
        console.log('- Base64 length:', encryptedData.length);
        console.log('- Decoded length:', decoded.length);
        console.log('- First 16 bytes:', Array.from(bytes.slice(0, 16)));
        console.log('- Middle 16 bytes:', Array.from(bytes.slice(Math.floor(bytes.length/2)-8, Math.floor(bytes.length/2)+8)));
        console.log('- Last 16 bytes:', Array.from(bytes.slice(-16)));
        
        // Look for patterns
        const patterns = [];
        for (let i = 0; i < bytes.length - 16; i++) {
            const slice = bytes.slice(i, i + 16);
            if (slice.every(b => b >= 32 && b <= 126)) {
                patterns.push({
                    offset: i,
                    text: new TextDecoder().decode(slice)
                });
            }
        }
        if (patterns.length > 0) {
            console.log('Possible text patterns found:', patterns);
        }
    } catch (e) {
        console.error('Analysis failed:', e);
    }
};

  useEffect(() => {
    const testEncryption = async () => {
      if (!encryptionManager || !encryptionManager.isInitialized) {
        console.log('Waiting for encryption manager initialization...');
        return;
      }
      
      const keys = Object.keys(encryptionManager.symmetricKeys);
      if (keys.length === 0) {
        console.log('No keys loaded yet, skipping test');
        return;
      }

      console.log('Testing encryption/decryption with loaded keys:', keys);
      for (const friendId of friends) {
        const result = await encryptionManager.testEncryptionDecryption(friendId);
        console.log(`Encryption test result for ${friendId}:`, result);
      }
    };

    testEncryption();
  }, [encryptionManager?.isInitialized, friends]); // Only run when encryption manager is initialized or friends list changes

  useEffect(() => {
    const testEncryption = async () => {
        if (!encryptionManager) return;
        
        console.log('Running basic encryption test...');
        const basicResult = await encryptionManager.basicEncryptionTest('seah0rse.testnet');
        console.log('Basic encryption test result:', basicResult);
    };

    testEncryption();
  }, [encryptionManager]);

  const clearAndReset = async () => {
    try {
        // Clear stored data
        await clearAllFriendData();
        
        // Clear local keys
        clearLocalKeys();
        
        // Reinitialize encryption manager
        setEncryptionManager(new EncryptionManager(wallet));
        
        console.log('Cleared all data and reset encryption');
    } catch (error) {
        console.error('Error clearing data:', error);
    }
};

  const clearEverything = async () => {
    try {
      setIsLoading(true);
      
      // Clear contract data
      await wallet.callMethod({
        contractId: CONTRACT_ADDRESS,
        method: 'clear_all_friend_data',
        args: {}
      });
      
      // Clear all state
      setFriends([]);
      setPendingRequests([]);
      setOutgoingRequests([]);
      setFriendsData({});
      setReceivedMessages({});
      
      // Clear local storage
      localStorage.clear();
      
      // Reset encryption manager
      const newManager = new EncryptionManager(wallet);
      await newManager.initialize();
      setEncryptionManager(newManager);
      
      // Refresh UI
      await refreshFriendLists();
      await checkPendingRequests();
      
      console.log('Successfully cleared everything');
    } catch (error) {
      console.error('Failed to clear:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testDataStorage = async (friendId: string) => {
    try {
      const testData = {
        message: 'Test message',
        timestamp: Date.now()
      };
      
      console.log('Storing test data for:', friendId);
      const success = await encryptionManager?.storeEncryptedData(testData, friendId);
      
      if (success) {
        console.log('Successfully stored test data');
        await loadFriendsData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to store test data:', error);
    }
  };

  const sendTestMessage = async (friendId: string) => {
    try {
      setIsLoading(true);
      
      const message = {
        text: messageText,
        timestamp: Date.now(),
        type: 'test'
      };
      
      const success = await encryptionManager?.storeFriendMessage(friendId, message);
      
      if (success) {
        console.log('Message sent successfully');
        setMessageText('');
        await loadFriendMessages();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFriendMessages = async () => {
    for (const friendId of friends) {
      try {
        console.log('Loading messages from:', friendId);
        const messages = await encryptionManager?.getFriendMessages(friendId);
        
        if (messages) {
          console.log('Received messages from:', friendId, messages);
          setFriendsData(prev => ({
            ...prev,
            [friendId]: {
              ...prev[friendId],
              messages
            }
          }));
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Friend Manager</h2>
        <button 
          onClick={checkPendingRequests}
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2"
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing...' : (
            <>
              <span>Refresh</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </>
          )}
        </button>
      </div>
      
      {friends.length > 0 && (
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Friends</h3>
          <div className="space-y-2">
            {friends.map((friendId) => (
              <div key={friendId} className="p-2 bg-gray-50 rounded flex items-center justify-between">
                <span>{friendId}</span>
                <button 
                  onClick={() => removeFriend(friendId)}
                  className="text-red-500 hover:text-red-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {outgoingRequests.length > 0 && (
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Outgoing Requests</h3>
          <div className="space-y-2">
            {outgoingRequests.map((request) => (
              <div key={request.to} className="p-2 bg-gray-50 rounded flex items-center justify-between">
                <span>{request.to}</span>
                <span className="text-sm text-gray-500">Pending</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* pending requests section */}
      {pendingRequests.length > 0 && (
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Pending Requests</h3>
          <div className="space-y-2">
            {pendingRequests.map((request) => (
              <div key={request.from} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>{request.from}</span>
                <button 
                  onClick={() => handleAcceptFriend(request)}
                  className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                >
                  Accept
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* send request section */}
      <div className="space-y-4">
        <input
          value={friendId}
          onChange={(e) => setFriendId(e.target.value)}
          placeholder="Friend's NEAR account ID"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <button 
          onClick={() => sendFriendRequest(friendId)}
          className="w-full bg-sky-400 text-white px-4 py-2 rounded-md hover:bg-sky-500 transition-colors"
        >
          Send Friend Request
        </button>
      </div>

      {friends.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Friends' Calendars</h2>
          {friends.map(friendId => (
            <FriendCalendar 
              key={friendId}
              friendId={friendId}
              calendarData={friendsData[friendId]?.calendar}
            />
          ))}
        </div>
      )}
      {/* message sending section */}
      <div className="mt-8 border-t border-gray-200 pt-4">
        <h3 className="text-lg font-medium text-gray-700 mb-2">Send Message</h3>
        <div className="space-y-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message to send to your friends..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-400"
            rows={3}
          />
          <button
            onClick={() => {
              if (!message.trim()) return; // don't send empty messages
              friends.forEach(friendId => sendMessage(friendId));
            }}
            className="w-full bg-sky-400 text-white px-4 py-2 rounded-md hover:bg-sky-500 transition-colors"
          >
            Send Message
          </button>
          <div className="flex gap-4">
            {friends.map(friendId => (
              <div key={friendId} className="flex flex-col gap-2">
                <span className="text-sm text-gray-600">{friendId}</span>
                {friendsData[friendId]?.messages?.map((msg: any, index: number) => (
                  <div key={index} className="text-sm bg-gray-50 p-2 rounded">
                    <div>{msg.text}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(msg.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* danger zone section */}
      <div className="mt-8 pt-4 border-t border-gray-200">
        <h3 className="text-lg font-medium text-red-700 mb-2">Danger Zone</h3>
        <div className="flex gap-4">
          <button
            onClick={clearAllFriendData}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
            disabled={isLoading}
          >
            Clear Friend Data
          </button>
          <button
            onClick={clearEverything}
            className="px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-800 transition-colors"
            disabled={isLoading}
          >
            Reset Everything
          </button>
        </div>
      </div>
    </div>
  );
}
