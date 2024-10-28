'use client';

import { useEffect, useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import "./globals.css";

import { NearContext, Wallet } from '@wallets';
import { NetworkId } from '../config';

const wallet = new Wallet({ networkId: NetworkId });

export default function RootLayout({ children }) {
  const [signedAccountId, setSignedAccountId] = useState('');

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      console.error('Missing GOOGLE_CLIENT_ID environment variable');
      return;
    }
    wallet.startUp(setSignedAccountId);
  }, []);

  return (
    <html lang="en">
      <body>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
          <NearContext.Provider value={{ wallet, signedAccountId }}>
            {children}
          </NearContext.Provider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
