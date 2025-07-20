import { useState, useEffect, useRef } from 'react';
import Message from '@/components/Message';
import BatchConfirmation from '@/components/BatchConfirmation';
import StatusDashboard from '@/components/StatusDashboard';

// --- NEW: Import the custom hook ---
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

const API_URL = 'http://localhost:8000'; // Your FastAPI backend URL

// --- NEW: Custom Hook for Typing Animation ---
const useTypingEffect = (text, duration) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    if (!text) return;
    setDisplayedText(''); // Reset if text changes
    let i = 0;
    const intervalId = setInterval(() => {
      // This is the new, more robust logic.
      // It builds the substring from the original text each time.
      setDisplayedText(text.substring(0, i + 1));
      i++;
      
      if (i > text.length) {
        clearInterval(intervalId);
      }
    }, duration);

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [text, duration]);

  return displayedText;
};

// --- NEW: Animated Header Component ---
const AnimatedHeader = () => {
  const fullTitle = "User Management Bot ✨";
  const animatedTitle = useTypingEffect(fullTitle, 100); // 100ms per character
  return <h1 className="text-xl font-semibold">{animatedTitle}</h1>;
};


export default function Home() {

  //const = useState(null);
  const [messages, setMessages] = useState([]); // FIX: Initialize with an empty array
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [processingEvents, setProcessingEvents] = useState([]); // FIX: Initialize with an empty array

  const [confirmationData, setConfirmationData] = useState(null); // NEW
  const [sessionId, setSessionId] = useState(null); // FIXED
  const { text, isListening, startListening, stopListening, hasRecognitionSupport } = useSpeechRecognition();

  const chatEndRef = useRef(null);

    // This ref helps us track the previous listening state
  const prevIsListening = useRef(false);


    // --- NEW: Effect to update the input field with the transcript ---
    useEffect(() => {
      if (text) {
        setInput(text);
      }
    }, [text]);

      // --- NEW: Effect to auto-send message on speech end ---
    // useEffect(() => {
    //   // Check if listening has just stopped (i.e., changed from true to false)
    //   if (prevIsListening.current && !isListening && input.trim()) {
    //     handleSend();
    //   }
    //   // Update the ref for the next render
    //   prevIsListening.current = isListening;
    // }, [isListening, input]);


   // Effect to create a session on initial load
   useEffect(() => {
    if (sessionId) return;

    const createSession = async () => {
      try {
        const res = await fetch(`${API_URL}/sessions`, { method: 'POST' });
        const data = await res.json();
        setSessionId(data.session_id);
        setMessages([{ role: 'assistant', content: 'Hello! How can I assist you with user management tasks today?' }]);
      } catch (error) {
        console.error("Failed to create session:", error);
        setMessages([{ role: 'assistant', content: 'Error: Could not connect to the bot service.' }]);
      }
    };
    createSession();
  },);

  // Effect to scroll to the bottom of the chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  },);

  const sendMessageToServer = async (text) => {
    if (!sessionId) return;
    setIsLoading(true);
    setConfirmationData(null);

    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      console.log(data)
      if (data.batch_status?.awaiting_batch_confirmation) {
        setConfirmationData(data);
      }
      if (data.ai_response) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.ai_response }]);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };


  const handleSend = (e) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;
    
    stopListening();
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    sendMessageToServer(input);
    setInput('');
  };


  const handleConfirmBatch = async () => {
    if (!sessionId) return;
    // FIX: Immediately hide the confirmation card to prevent double clicks.
    const userConfirmationMessage = { role: 'user', content: 'Yes, proceed.' };
   // setMessages(prev => [...prev, userConfirmationMessage]);
    setConfirmationData(null);

        // FIX: Add a special 'status_card' message to the chat flow.
      const statusCardMessage = { role: 'system', type: 'status_card', events:[] };
      setMessages(prev => [...prev, userConfirmationMessage, statusCardMessage]);
    
    try {
      await fetch(`${API_URL}/sessions/${sessionId}/process-batch`, { method: 'POST' });
      listenForStatusUpdates();
    } catch (error) {
      console.error("Failed to start batch processing:", error);
    }
  };

  const handleRejectBatch = async() => {
    const userRejectionMessage = { role: 'user', content: 'No, I need to make changes.' };
    setMessages(prev => [...prev, userRejectionMessage]);
    setConfirmationData(null);
    //document.getElementById('chat-input').focus();

    setIsLoading(true); // Show the "Thinking..." indicator
    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userRejectionMessage.content }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.ai_response }]);
    } catch (error) {
      console.error("Failed to send rejection:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'An error occurred. Please try again.' }]);
    } finally {
      setIsLoading(false);
      document.getElementById('chat-input').focus();
    }

  };

    // The missing function is now defined here.
    const handleMicClick = () => {
      if (isListening) {
        stopListening();
      } else {
        startListening();
      }
    };
  


  const listenForStatusUpdates = () => {
    // FIX: Clear previous events before showing the new card.
    setProcessingEvents([]);
    const eventSource = new EventSource(`${API_URL}/sessions/${sessionId}/process-batch/status`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      //setProcessingEvents(prev => [...prev, data]);

      // FIX: Update the events inside the status card message object.
      setMessages(prevMessages => {
        return prevMessages.map(msg => {
          if (msg.type === 'status_card') {
            return {...msg, events: [...msg.events, data] };
          }
          return msg;
        });
      });
      
      // FIX: When the "complete" event is received, trigger the final summary.
      if (data.type === 'phase' && data.status === 'complete') {
        eventSource.close();
        // Use a short timeout to ensure the last event renders before fetching.
        //setTimeout(() => fetchFinalSummary(), 500);
        getFinalSummary();
      } else {
        setProcessingEvents(prev => [...prev, data]);
      }
    };
    eventSource.onerror = (err) => {
      console.error("EventSource failed:", err);
      eventSource.close();
    };
  };
  const getFinalSummary = async () => {
    await sendMessageToServer("ACTION:SUMMARIZE_RESULTS");
  };

  return (
    <div className="bg-gray-800 text-white flex flex-col h-screen font-sans">
      <header className="p-4 border-b border-gray-700 flex justify-between items-center shrink-0">
        <div className="flex-1 flex justify-center"><AnimatedHeader /></div>
        <button onClick={() => window.location.reload()} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600">Start Over</button>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          {/*{messages.map((msg, i) => <Message key={i} message={msg} />)} */}
                    {/* FIX: The main render loop now handles different message types. */}
          {Array.isArray(messages) && messages.map((msg, i) => {
            if (msg.type === 'status_card') {
              return (
                <div key={i} className="flex w-full justify-start">
                  <StatusDashboard events={msg.events} />
                </div>
              );
            }
            // Render regular messages
            return <Message key={i} message={msg} />;
          })}

          
          {confirmationData && (
            <div className="flex w-full justify-start">
              <BatchConfirmation summary={confirmationData.consolidated_summary_for_confirmation} onConfirm={handleConfirmBatch} onReject={handleRejectBatch} />
            </div>
          )}

          {isLoading && <Message message={{ role: 'assistant', content: 'Thinking...' }} />}
          <div ref={chatEndRef} />
        </div>
      </main>

      <footer className="p-4 bg-gray-800 shrink-0">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSend} className="flex items-center gap-2 bg-gray-700 rounded-full p-2 shadow-lg">
            <input
              id="chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Add, Update Role, or Activate/Deactivate User..."
              className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none px-4 py-2"
              disabled={isLoading ||!!confirmationData || processingEvents.length > 0}
            />
            {/* --- NEW: Microphone Button --- */}
            {hasRecognitionSupport && (
              <button type="button" onClick={handleMicClick} 
              className={`p-3 rounded-full transition-colors ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-600 hover:bg-gray-500'} disabled:bg-gray-500`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0V4Z" />
                  <path d="M5.5 4.5a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-6Z" />
                  <path d="M10 15.5a4.5 4.5 0 0 1-4.5-4.5a.5.5 0 0 1 1 0a3.5 3.5 0 0 0 7 0a.5.5 0 0 1 1 0a4.5 4.5 0 0 1-4.5 4.5Z" />
                </svg>
              </button>
            )}
            <button
              type="submit"
              className="p-3 bg-blue-600 rounded-full hover:bg-blue-500 disabled:bg-gray-500"
              disabled={isLoading ||!input.trim() ||!!confirmationData || processingEvents.length > 0}
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M3.105 3.105a.75.75 0 0 1.814-.156l14.686 4.895a.75.75 0 0 1 0 1.312L3.919 14.05a.75.75 0 0 1-.814-.156l-.618-.93A.75.75 0 0 1 2.73 12h5.02a.75.75 0 0 0 0-1.5H2.73a.75.75 0 0 1.23-.564l.618-.93Z" /></svg>
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}

  