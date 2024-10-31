import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000'
);

export async function POST(request: Request) {
    const body = await request.json();
    const { credential } = body;

    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (payload) {
            const userId = payload['sub'];
        }

        return NextResponse.json({ access_token: credential });
    } catch (error) {
        console.error('Error verifying Google token:', error);
        return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }
}
