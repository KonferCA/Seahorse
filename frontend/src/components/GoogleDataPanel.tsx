import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { google } from 'googleapis';
import Image from 'next/image';
import googleIcon from '@/components/icons/google.svg';

type GoogleDataPanelProps = {
    onDataReceived: (calendar: any[], emails: any[]) => void;
};

export default function GoogleDataPanel({
    onDataReceived,
}: GoogleDataPanelProps) {
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
            // fetch emails directly from gmail api
            const emailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                }
            });
            const emailList = await emailResponse.json();

            // fetch full email content
            const emailsWithContent = await Promise.all(
                emailList.messages.map(async (message: any) => {
                    const fullEmail = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        }
                    });
                    return fullEmail.json();
                })
            );

            // fetch calendar events
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const calendarResponse = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events?` + 
                `timeMin=${thirtyDaysAgo.toISOString()}&maxResults=10&singleEvents=true&orderBy=startTime`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                }
            });
            const calendarData = await calendarResponse.json();

            onDataReceived(calendarData.items || [], emailsWithContent || []);
            setIsConnected(true);
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
                disabled={isLoading || isConnected}
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
                            : 'Connect Google Account'}
                </span>
            </button>

            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        </div>
    );
}
