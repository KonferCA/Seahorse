import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const accessToken = authHeader.split(' ')[1];

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    try {
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

        // modify the return statement to include full email data
        return NextResponse.json({
            emails: emailsWithContent,
            calendar: calendarResponse.data.items,
        });
    } catch (error) {
        console.error('Error fetching user data:', error);
        return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
    }
}
