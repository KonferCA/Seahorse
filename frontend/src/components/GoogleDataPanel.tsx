import { useState, useRef } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import Image from 'next/image';
import googleIcon from '@/components/icons/google.svg';
import { formatGoogleData } from '@/utils/formatGoogleData';

type GoogleDataPanelProps = {
    onDataReceived: (calendar: any[], emails: any[]) => void;
};

export default function GoogleDataPanel({ onDataReceived }: GoogleDataPanelProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [ragProgress, setRagProgress] = useState({ completed: 0, total: 0 });

    const login = useGoogleLogin({
        onSuccess: (tokenResponse) => {
            fetchUserData(tokenResponse.access_token);
        },
        scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly',
        onError: (errorResponse) => {
            setError('Failed to connect to Google');
            console.error('Google login error:', errorResponse);
        }
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

            if (!response.ok) {
                throw new Error('Failed to fetch data');
            }

            const data = await response.json();
            onDataReceived(data.calendar, data.emails);
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
                disabled={isLoading}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border 
                    ${isLoading
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
                    {isLoading ? 'Connecting...' : 'Connect Google Account'}
                </span>
            </button>

            {ragProgress.total > 0 && (
                <div className="mt-3">
                    <div className="text-sm text-gray-600">
                        Processing data: {ragProgress.completed}/{ragProgress.total}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                        <div 
                            className="bg-blue-600 h-2.5 rounded-full" 
                            style={{ width: `${(ragProgress.completed / ragProgress.total) * 100}%` }}
                        ></div>
                    </div>
                </div>
            )}

            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        </div>
    );
}