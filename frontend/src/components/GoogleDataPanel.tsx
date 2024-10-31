import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import Image from 'next/image';
import googleIcon from '@/components/icons/google.svg';

type GoogleDataPanelProps = {
    onDataReceived: (calendar: any[], emails: any[]) => void;
};

export default function GoogleDataPanel({ onDataReceived }: GoogleDataPanelProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isConnected, setIsConnected] = useState(false);

    const login = useGoogleLogin({
        onSuccess: (tokenResponse) => {
            fetchUserData(tokenResponse.access_token);
        },
        scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly',
    });

    const fetchUserData = async (accessToken: string) => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch('/api/user-data', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                onDataReceived(data.calendar, data.emails);
                setIsConnected(true);
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to fetch data');
            }
        } catch (error) {
            setError('Error connecting to Google services');
            console.error('Error fetching user data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full">
            <button
                onClick={() => login()}
                disabled={isLoading || isConnected}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                    transition-colors duration-300
                    ${isConnected
                        ? 'bg-[#22886c]/10 border-2 border-[#22886c] text-[#22886c] cursor-not-allowed'
                        : isLoading
                        ? 'bg-[#0f2c24] border-2 border-[#22886c]/20 text-white/50 cursor-not-allowed'
                        : 'bg-[#22886c] border-2 border-[#22886c] text-white hover:bg-[#1b6d56]'
                    }`}
            >
                <Image
                    src={googleIcon}
                    alt="Google icon"
                    className="w-5 h-5"
                    width={20}
                    height={20}
                />
                <span className="font-medium">
                    {isConnected
                        ? 'Google Account Connected'
                        : isLoading
                        ? 'Connecting...'
                        : 'Connect Google Account'
                    }
                </span>
            </button>
            {error && (
                <div className="mt-3 text-sm text-[#22886c]">{error}</div>
            )}
        </div>
    );
};