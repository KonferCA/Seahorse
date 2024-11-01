'use client';

import { useEffect, useState, Suspense } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';
import { NearContext, Wallet } from '@wallets';
import { NetworkId } from '../config';
import { useTransactionToast } from '@/hooks/useTransactionToast';
import { ReactNode } from 'react';

import '../app/globals.css';

const wallet = new Wallet({ networkId: NetworkId });

const TransactionToastWrapper = () => {
    useTransactionToast();
    return null;
};

export default function ClientLayout({ children }: { children: ReactNode }) {
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
                    <NearContext.Provider value={{ wallet: wallet as any, signedAccountId }}>
                        <Suspense fallback={null}>
                            {children}
                            <TransactionToastWrapper />
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
                        </Suspense>
                    </NearContext.Provider>
                </GoogleOAuthProvider>
            </body>
        </html>
    );
};