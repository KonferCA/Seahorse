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
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Import Google Data
            </h3>

            <button
                onClick={() => login()}
                disabled={ isLoading || isConnected }
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border 
                    ${isConnected 
                        ? 'bg-green-50 border-green-200 text-green-700 cursor-not-allowed'
                        : isLoading
                        ? 'bg-gray-100 border-gray-200 cursor-not-allowed'
                        : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
            >
                <Image
                    src={googleIcon}
                    alt="Google icon"
                    className="w-5 h-5"
                    width={20}
                    height={20}
                />
                <span className="text-gray-700 font-medium">
                    {isConnected
                        ? 'Google Account Connected'
                        : isLoading
                        ? 'Connecting...'
                        : 'Connect Google Account' 
                    }
                </span>
            </button>

            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        </div>
    );
}