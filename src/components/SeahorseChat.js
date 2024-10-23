'use client';
import { useState } from 'react';

export const SeahorseChat = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputMessage.trim() === '') return;

    setMessages([...messages, { text: inputMessage, sender: 'user' }]);
    setMessages((prevMessages) => [...prevMessages, { text: 'Seahorse!', sender: 'seahorse' }]);
    setInputMessage('');
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-8">
        <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold mb-4">Seahorse Chat</div>
        <div className="h-64 overflow-y-auto mb-4">
          {messages.map((message, index) => (   
            <div
              key={index}
              className={`p-2 rounded-lg mb-2 ${
                message.sender === 'user' ? 'bg-blue-100 text-right' : 'bg-green-100'
              }`}
            >
              {message.text}
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-grow mr-2 p-2 border rounded"
          />
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
