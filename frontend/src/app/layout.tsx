'use client';

import { useEffect, useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';
import "./globals.css";

import { NearContext, Wallet } from '@wallets';
import { NetworkId } from '../config';
import { useTransactionToast } from '@/hooks/useTransactionToast';

const wallet = new Wallet({ networkId: NetworkId });

export default function RootLayout({ children }) {
  const [signedAccountId, setSignedAccountId] = useState('');
  useTransactionToast();

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
            <Toaster 
              position="bottom-right"
              toastOptions={{
                duration: 5000,
                style: {
                  background: '#fff',
                  color: '#363636',
                }
              }}
            />
          </NearContext.Provider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
