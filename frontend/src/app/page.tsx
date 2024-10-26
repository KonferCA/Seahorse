'use client'

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, useContext } from 'react';

import { NearContext } from '@wallets';
import NearLogo from '/public/near-logo.svg';

export default function Login() {
    const { signedAccountId, wallet } = useContext(NearContext);
    const [action, setAction] = useState<() => void>(() => () => {});
    const [label, setLabel] = useState('Loading...');
    
    useEffect(() => {
        if (!wallet) return;
    
        if (signedAccountId) {
          setAction(() => wallet.signOut);
          setLabel(`Logout ${signedAccountId}`);
        } else {
          setAction(() => wallet.signIn);
          setLabel('Login');
        }
    }, [signedAccountId, wallet]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-center">Login</h1>
                <button
                    className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={action}
                >
                    {label}
                </button>

                <div className="mt-4 text-center">
                    <p className="text-sm text-gray-600">
                        Don't have an account?{" "}
                        <Link href="/signup" className="text-blue-500 hover:underline">
                            Sign up
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};