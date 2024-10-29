import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, NearContext } from '@wallets';
import { NetworkId } from '@/config';

// create near auth gate component
export default function NearAuthGate({ children }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [wallet] = useState(new Wallet({ networkId: NetworkId }));
  const router = useRouter();

  useEffect(() => {
    // initialize wallet and check sign in status
    const checkAuth = async () => {
      try {
        const accountId = await wallet.startUp((account) => {
          setIsSignedIn(!!account);
        });
        setIsSignedIn(!!accountId);
      } catch (err) {
        console.error('Failed to initialize wallet:', err);
        setIsSignedIn(false);
      }
    };

    checkAuth();
  }, [wallet]);

  // if not signed in, show login button
  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl mb-4">Please sign in with NEAR wallet to continue</h1>
        <button
          onClick={() => wallet.signIn()}
          className="bg-sky-400 px-4 py-2 rounded"
        >
          Connect NEAR Wallet
        </button>
      </div>
    );
  }

  // if signed in, render children
  return children;
}
