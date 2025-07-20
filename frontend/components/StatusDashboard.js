import React from 'react';

const StatusDashboard = ({ events }) => {
  const getStatusColor = (status) => {
    if (status.includes('success')) return 'text-green-400';
    if (status.includes('failed')) return 'text-red-400';
    if (status.includes('processing')) return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
    <div className="bg-gray-700 self-center rounded-xl shadow-lg max-w-lg w-full my-4">
       <div className="p-4 border-b border-gray-600">
        <h3 className="font-bold text-lg text-white">Batch Processing Status</h3>
      </div>
      <div className="p-4 space-y-2">
        {events.map((event, index) => (
          <div key={index} className="text-sm">
            {event.type === 'phase' && (
              <p className="font-semibold text-blue-400 mt-2 border-t border-gray-600 pt-2">{event.message}</p>
            )}
            {event.type === 'update' && (
              <p>
                <span className="font-mono bg-gray-800 px-1 rounded">Req ID: {event.request_id}</span> -{' '}
                <span className={getStatusColor(event.status)}>{event.status.replace(/_/g, ' ')}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatusDashboard;