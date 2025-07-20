import React from 'react';

const Message = ({ message }) => {
  const isBot = message.role === 'assistant';
  return (
    <div className={`flex w-full max-w-4xl mx-auto ${isBot? 'justify-start' : 'justify-end'}`}>
      <div 
        className={`max-w-xl lg:max-w-2xl px-4 py-3 rounded-2xl shadow-md ${isBot? 'bg-gray-700 rounded-bl-none' : 'bg-blue-600 rounded-br-none'}`}
      >
        <p className="text-white whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
};

export default Message;