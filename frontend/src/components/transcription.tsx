'use client';

import { useContext } from 'react';
import { NearContext } from '@wallets';

export const Transcription = () => {
    const { signedAccountId, wallet } = useContext(NearContext);

    return (
        <div className="mt-8">
            <div className="flex gap-4 mb-4">
                <button
                    onClick={toggleListening}
                    className={`px-4 py-2 rounded-md ${
                        isListening 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : 'bg-green-500 hover:bg-green-600'
                    } text-white`}
                >
                    {isListening ? 'Stop Listening' : 'Start Listening'}
                </button>
                <button
                    onClick={() => signedAccountId ? wallet.signOut() : wallet.signIn()}
                    className="px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white"
                >
                    {signedAccountId ? `Sign out (${signedAccountId})` : 'Sign in with NEAR'}
                </button>
                <button
                    onClick={() => googleLogin()}
                    className="px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white"
                >
                    Sign in with Google
                </button>
            </div>
            
        </div>
    );
};
