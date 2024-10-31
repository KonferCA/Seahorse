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
            const oauth2Client = new google.auth.OAuth2();
            oauth2Client.setCredentials({ access_token: accessToken });

            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
            const calendar = google.calendar({
                version: 'v3',
                auth: oauth2Client,
            });

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // fetch emails
            const emailResponse = await gmail.users.messages.list({
                userId: 'me',
                q: `after:${thirtyDaysAgo.getFullYear()}/${thirtyDaysAgo.getMonth() + 1}/${thirtyDaysAgo.getDate()}`,
                maxResults: 10,
            });

            // fetch full email content for each message
            const emailsWithContent = await Promise.all(
                emailResponse.data.messages.map(async (message) => {
                    const fullEmail = await gmail.users.messages.get({
                        userId: 'me',
                        id: message.id,
                    });
                    return fullEmail.data;
                })
            );

            // fetch calendar events
            const calendarResponse = await calendar.events.list({
                calendarId: 'primary',
                timeMin: thirtyDaysAgo.toISOString(),
                maxResults: 10,
                singleEvents: true,
                orderBy: 'startTime',
            });

            onDataReceived(calendarResponse.data.items, emailsWithContent);
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
