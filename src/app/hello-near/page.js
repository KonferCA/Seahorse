'use client';
import { useState, useEffect, useContext } from 'react';

import { Cards } from '@/components/cards';

import { NearContext } from '@/wallets/near';
import { HelloNearContract } from '@/config';

// Contract that the app will interact with
const CONTRACT = HelloNearContract;

export default function HelloNear() {
  const { signedAccountId, wallet } = useContext(NearContext);

  const [greeting, setGreeting] = useState('loading...');
  const [newGreeting, setNewGreeting] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    if (!wallet) return;

    wallet.viewMethod({ contractId: CONTRACT, method: 'get_greeting' })
      .then(greeting => setGreeting(greeting));
  }, [wallet]);

  useEffect(() => {
    setLoggedIn(!!signedAccountId);
  }, [signedAccountId]);

  const storeGreeting = async () => {
    setShowSpinner(true);
    await wallet.callMethod({ contractId: CONTRACT, method: 'set_greeting', args: { greeting: newGreeting } });
    const greeting = await wallet.viewMethod({ contractId: CONTRACT, method: 'get_greeting' });
    setGreeting(greeting);
    setShowSpinner(false);
  };

  return (
    <main className="flex flex-col items-center justify-between py-24">
      <div className="w-full max-w-2xl">
        <p className="text-center mb-4">
          Interacting with the contract: <code className="bg-gray-200 p-1 rounded">{CONTRACT}</code>
        </p>

        <div className="bg-white rounded-xl shadow-md p-8 mb-8">
          <h1 className="text-2xl font-bold mb-4">The contract says: <code className="bg-gray-200 p-1 rounded">{greeting}</code></h1>
          {loggedIn ? (
            <div className="flex">
              <input 
                type="text" 
                className="flex-grow mr-2 p-2 border rounded" 
                placeholder="Store a new greeting" 
                onChange={e => setNewGreeting(e.target.value)} 
              />
              <button 
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                onClick={storeGreeting}
              >
                {showSpinner ? (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          ) : (
            <p className="text-center">Please login to change the greeting</p>
          )}
        </div>

        <Cards />
      </div>
    </main>
  );
}
