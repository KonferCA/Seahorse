import { formatCalendarEvent } from '../utils/formatGoogleData';

export default function FriendCalendar({ friendId, calendarData }) {
  if (!calendarData) return null;

  return (
    <div className="mt-4">
      <h3 className="text-lg font-medium text-gray-700 mb-2">
        {friendId}'s Calendar
      </h3>
      <div className="space-y-4">
        {calendarData.map((event, index) => (
          <div key={index} className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 whitespace-pre-wrap">
              {formatCalendarEvent(event)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 