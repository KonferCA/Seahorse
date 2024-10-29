'use client';
import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';

export default function GoogleAuth({ onDataReceived }) {
    const [userEmails, setUserEmails] = useState('');
    const [userCalendar, setUserCalendar] = useState('');

    const login = useGoogleLogin({
        onSuccess: (tokenResponse) => {
            console.log("Token Response:", tokenResponse);
            fetchUserData(tokenResponse.access_token);
        },
        scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly',
    });

    const fetchUserData = async (accessToken) => {
        try {
            const response = await fetch('/api/user-data', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setUserEmails(JSON.stringify(data.emails, null, 2));
                setUserCalendar(JSON.stringify(data.calendar, null, 2));
                // pass the data to parent component
                onDataReceived(data.calendar, data.emails);
            } else {
                const errorData = await response.json();
                console.error('Failed to fetch user data:', errorData);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    };

    return (
        <div>
            <button onClick={() => login()}>Sign in with Google</button>
            <div>
                <h2>User Emails:</h2>
                <pre>{userEmails}</pre>
                <h2>User Calendar:</h2>
                <pre>{userCalendar}</pre>
            </div>
        </div>
    );
}
