import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
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
