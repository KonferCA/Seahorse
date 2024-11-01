interface CalendarEvent {
    id: string;
    summary?: string;
    description?: string;
    start: {
        dateTime?: string;
        date?: string;
    };
    end?: {
        dateTime?: string;
        date?: string;
    };
    location?: string;
    attendees?: { email: string }[];
}

export function formatCalendarEvent(event: CalendarEvent): string {
    // extract key terms from description for better matching
    const description = event.description?.toLowerCase() || '';
    const summary = event.summary?.toLowerCase() || '';
    
    return `
----------------------------------------
EVENT DETAILS
----------------------------------------
Title: ${event.summary}
Type: ${summary.includes('bbq') ? 'BBQ Event' : 'General Event'}
Date: ${event.start.dateTime || event.start.date}
Location: ${event.location || 'No location'}
Keywords: ${extractKeywords(summary + ' ' + description)}
Description: ${event.description || 'No description'}
----------------------------------------
    `.trim();
}

function extractKeywords(text: string) {
  // extract important keywords, removing common words
  const keywords = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => 
      word.length > 2 && 
      !['the', 'and', 'for', 'with', 'this'].includes(word)
    )
    .join(' ');
  return keywords;
}

interface EmailHeader {
  name: string;
  value: string;
}

export function formatEmail(email: { payload: { headers: EmailHeader[] }, internalDate: string, snippet?: string }) {
  const subject = email.payload.headers.find(
    (header: EmailHeader) => header.name === 'Subject'
  )?.value || 'No subject';
  
  const from = email.payload.headers.find(
    (header: EmailHeader) => header.name === 'From'
  )?.value || 'No sender';

  return `
----------------------------------------
EMAIL DETAILS
----------------------------------------
From: ${from}
Subject: ${subject}
Date: ${new Date(parseInt(email.internalDate)).toLocaleString()}
Content: ${email.snippet?.replace(/[\n\r]/g, ' ').trim() || 'No preview available'}
----------------------------------------
  `.trim();
}

interface GoogleCalendarEvent {
    id: string;
    summary?: string;
    description?: string;
    start: {
        dateTime?: string;
        date?: string;
    };
    end?: {
        dateTime?: string;
        date?: string;
    };
    location?: string;
    attendees?: { email: string }[];
}

interface GoogleEmail {
    id: string;
    payload: {
        headers: EmailHeader[];
    };
    internalDate: string;
    snippet?: string;
}

interface FormattedItem {
    type: 'calendar' | 'email';
    content: string;
    metadata: {
        type: 'calendar' | 'email';
        eventId?: string;
        emailId?: string;
        title: string;
        date: string | null;
        endDate?: string | null;
        from?: string;
    };
}

export function formatGoogleData(calendar: GoogleCalendarEvent[], emails: GoogleEmail[]): FormattedItem[] {
    const formattedItems: FormattedItem[] = [];
    
    // format calendar events
    calendar.forEach(event => {
        try {
            const startDate = event.start?.dateTime || event.start?.date;
            const endDate = event.end?.dateTime || event.end?.date;
            
            const content = `
Event: ${event.summary || 'Untitled Event'}
Date: ${startDate ? new Date(startDate).toLocaleString() : 'No date'}
${endDate ? `End: ${new Date(endDate).toLocaleString()}` : ''}
${event.description ? `Description: ${event.description}` : ''}
${event.location ? `Location: ${event.location}` : ''}
Attendees: ${(event.attendees || []).map(a => a.email).join(', ')}
            `.trim();

            formattedItems.push({
                type: 'calendar',
                content,
                metadata: {
                    type: 'calendar',
                    eventId: event.id,
                    title: event.summary || 'Untitled Event',
                    date: startDate ? new Date(startDate).toISOString() : null,
                    endDate: endDate ? new Date(endDate).toISOString() : null
                }
            });
        } catch (error) {
            console.error('Error processing calendar event:', error);
        }
    });
    
    // format emails
    emails.forEach(email => {
        try {
            const subject = email.payload?.headers?.find(h => h.name === 'Subject')?.value || 'No subject';
            const from = email.payload?.headers?.find(h => h.name === 'From')?.value || 'No sender';
            const date = email.internalDate ? new Date(parseInt(email.internalDate)) : new Date();
            
            const content = `
Subject: ${subject}
From: ${from}
Date: ${date.toLocaleString()}
Content: ${email.snippet || 'No content available'}
            `.trim();

            formattedItems.push({
                type: 'email',
                content,
                metadata: {
                    type: 'email',
                    emailId: email.id,
                    title: subject,
                    date: date.toISOString(),
                    from: from
                }
            });
        } catch (error) {
            console.error('Error processing email:', error);
        }
    });
    
    return formattedItems;
}
