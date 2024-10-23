'use client';

import { useEffect, useState } from 'react';

import '@/app/globals.css';
import { Navigation } from '@/components/navigation';
import { NetworkId } from '@/config';

import { NearContext, Wallet } from '@/wallets/near';

const wallet = new Wallet({ networkId: NetworkId });

// Layout Component
export default function RootLayout({ children }) {
  const [signedAccountId, setSignedAccountId] = useState('');

  useEffect(() => { wallet.startUp(setSignedAccountId); }, []);

  return (
    <html lang="en">
      <body className="bg-gray-100 min-h-screen">
        <NearContext.Provider value={{ wallet, signedAccountId }}>
          <Navigation />
          <div className="container mx-auto px-4">
            {children}
          </div>
        </NearContext.Provider>
      </body>
    </html>
  );
}
