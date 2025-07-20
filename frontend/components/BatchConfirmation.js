import React from 'react';

const BatchConfirmation = ({ summary, onConfirm, onReject }) => {
  return (
    <div className="bg-gray-700 self-center rounded-xl shadow-lg max-w-lg w-full my-4">
      <div className="p-4 border-b border-gray-600">
        <h3 className="font-bold text-lg text-white">Please Confirm Batch</h3>
      </div>
      <div className="p-4">
        <pre className="text-sm font-mono whitespace-pre-wrap bg-gray-800 text-gray-300 p-3 rounded-md">
          {summary}
        </pre>
      </div>
      <div className="p-4 flex justify-end gap-3 bg-gray-700/50 rounded-b-xl">
        <button
          onClick={onReject}
          className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 transition-colors font-medium"
        >
          Make Changes
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 transition-colors font-semibold"
        >
          Yes, Process Batch
        </button>
      </div>
    </div>
  );
};

export default BatchConfirmation;