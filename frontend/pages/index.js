import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router'; // Import useRouter for redirection
import Message from '@/components/Message';
import Head from 'next/head'; // <--- THIS IS THE MISSING LINE
import BatchConfirmation from '@/components/BatchConfirmation';
import StatusDashboard from '@/components/StatusDashboard';

// --- NEW: Import the custom hook ---
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

const API_URL = 'http://localhost:8000'; // Your FastAPI backend URL

// --- Helper function to check token expiration ---
const isTokenExpired = (token) => {
  if (!token) return true;
  try {
      // The token is in three parts: header.payload.signature
      const payloadBase64 = token.split('.')[1];
      const decodedJson = atob(payloadBase64);
      const decoded = JSON.parse(decodedJson);
      // The 'exp' claim is in seconds, so we convert the current time to seconds.
      const exp = decoded.exp;
      const now = Date.now() / 1000;
      return now > exp;
  } catch (error) {
      // If token is malformed, treat it as expired.
      return true;
  }
};


// --- Helper function for authenticated API calls(This function attaches the auth token to every request.) ---
const fetchWithAuth = async (url, options = {}) => {
  const token = window.localStorage.getItem('userToken');

  // Proactively check for expiration before making a request.
  if (isTokenExpired(token)) {
        window.localStorage.removeItem('userToken');
        window.location.href = '/login';
        throw new Error('Session expired. Please log in again.');
    }

  const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
  };

  if (token) {
      headers['Authorization'] = `Bearer ${token}`;
  }else {
    // If there's no token at all, don't even bother making the request. (Redirect straight to login. This helps break loops.)
    window.location.href = '/login';
    // Throw an error to stop the execution of the calling function.
    throw new Error('No authentication token found. Redirecting to login.');
  }

  const response = await fetch(url, { ...options, headers });

  // If the token is expired or invalid, the server will return a 401 error.
  // This logs the user out and redirects them to the login page.
  if (response.status === 401) {
      localStorage.removeItem('userToken');
      // Use window.location to force a full page reload to the login screen
      window.location.href = '/login'; 
      throw new Error('Session expired. Please log in again.');
  }

  return response;
};

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
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [messages, setMessages] = useState([]); // FIX: Initialize with an empty array
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [processingEvents, setProcessingEvents] = useState([]); // FIX: Initialize with an empty array

  const [confirmationData, setConfirmationData] = useState(null); // NEW
  const [sessionId, setSessionId] = useState(null); // FIXED
  const { text, isListening, startListening, stopListening, hasRecognitionSupport } = useSpeechRecognition();

  const chatEndRef = useRef(null);
  const router = useRouter(); // Initialize router for navigation

    // This ref helps us track the previous listening state
  const prevIsListening = useRef(false);

    // --- 1. AUTHENTICATION CHECK --- (This effect runs once when the component mounts. (It checks for a token and redirects to login if it's missing. This now runs only ONCE when the component first loads.)
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('userToken');
        // Check if the token is present AND not expired.
        if (isTokenExpired(token)) {
            localStorage.removeItem('userToken'); // Clean up expired token
            router.push('/login');
        } else {
            // If token is valid, proceed.
            setIsAuthLoading(false);
            if (!sessionId) {
                createSession();
            }
        }
    }
  }, []);// The empty array [] is crucial to prevent the infinite loop.
  

  // Effect to scroll to the bottom of the chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  });

    // --- NEW: Effect to update the input field with the transcript ---
  useEffect(() => {
    if (text) {
      setInput(text);
    }
  }, [text]);


  const createSession = async () => {
    try {
      // Use the authenticated fetch function
      const res = await fetchWithAuth(`${API_URL}/sessions`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create session.');
      
      const data = await res.json();

      console.log('Session data from backend:', data);
      setSessionId(data.session_id);
      setMessages([{ role: 'assistant', content: `Hello! How can I assist you today?` }]);
    } catch (error) {
      console.error("Session creation failed:", error);
      //setMessages([{ role: 'assistant', content: 'Error: Could not connect to the bot service.' }]);
    }
  };

  const sendMessageToServer = async (text) => {
    if (!sessionId) return;
    setIsLoading(true);
    setConfirmationData(null);

    try {
      const res = await fetchWithAuth(`${API_URL}/sessions/${sessionId}/messages`, {
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
      await fetchWithAuth(`${API_URL}/sessions/${sessionId}/process-batch`, { method: 'POST' });
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
      const res = await fetchWithAuth(`${API_URL}/sessions/${sessionId}/messages`, {
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


    // ---  AUTHENTICATE EVENTSOURCE --- (  Pass the token as a query parameter.)
    const token = localStorage.getItem('userToken');
    if (isTokenExpired(token)) {
      router.push('/login');
      return;
    }

    // Pass the token as a query parameter for EventSource authentication.
    const eventSource = new EventSource(`${API_URL}/sessions/${sessionId}/process-batch/status?token=${encodeURIComponent(token)}`);

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

    // ---  LOGOUT HANDLER ---
  const handleLogout = () => {
      localStorage.removeItem('userToken');
      router.push('/login');
    };

  const handleStartOver = () => {
      if(sessionId) {
          fetchWithAuth(`${API_URL}/sessions/${sessionId}`, { method: 'DELETE' });
      }
      setSessionId(null);
      setMessages([]);
      createSession();
      // The useEffect will trigger createSession() again.
  }

    // --- THIS IS THE RENDER-SIDE PART OF THE AUTH GUARD ---
    return (
      <>
        <Head>
          {/* This title is static and safe for Server-Side Rendering */}
          <title>User Management Bot</title>
        </Head>
  
        {isAuthLoading ? (
          // Loading Screen: Shown while authentication is being checked.
          <div className="flex items-center justify-center h-screen bg-gray-800 text-white">
              <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Authenticating...</span>
          </div>
        ) : (
          // Main Application UI: Shown only after authentication is confirmed.
          <div className="bg-gray-800 text-white flex flex-col h-screen font-sans">
            <header className="p-4 border-b border-gray-700 flex justify-between items-center shrink-0">
              <div className="flex-1 flex justify-start">
                <button onClick={handleStartOver} className="px-4 py-2 text-sm font-medium text-white-300 bg-blue-800 rounded-lg hover:bg-blue-700">
                  Start Over
                </button>
              </div>
              <div className="flex-1 flex justify-center"><AnimatedHeader /></div>
              <div className="flex-1 flex justify-end">
                <button onClick={handleLogout} className="px-4 py-2 text-sm font-medium text-gray-300 bg-red-700 rounded-lg hover:bg-red-600">
                  Sign Out
                </button>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto w-full space-y-6">
                {messages.map((msg, i) => {
                  if (msg.type === 'status_card') {
                    return <div key={i} className="flex w-full justify-start"><StatusDashboard events={msg.events} /></div>;
                  }
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
                    disabled={isLoading || !!confirmationData}
                  />
                  {hasRecognitionSupport && (
                    <button type="button" onClick={handleMicClick} className={`p-3 rounded-full transition-colors ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-600 hover:bg-gray-500'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0V4Z" /><path d="M5.5 4.5a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-6Z" /><path d="M10 15.5a4.5 4.5 0 0 1-4.5-4.5a.5.5 0 0 1 1 0a3.5 3.5 0 0 0 7 0a.5.5 0 0 1 1 0a4.5 4.5 0 0 1-4.5 4.5Z" /></svg>
                    </button>
                  )}
                  <button type="submit" className="p-3 bg-blue-600 rounded-full hover:bg-blue-500 disabled:bg-gray-500" disabled={isLoading || !input.trim() || !!confirmationData}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M3.105 3.105a.75.75 0 0 1.814-.156l14.686 4.895a.75.75 0 0 1 0 1.312L3.919 14.05a.75.75 0 0 1-.814-.156l-.618-.93A.75.75 0 0 1 2.73 12h5.02a.75.75 0 0 0 0-1.5H2.73a.75.75 0 0 1.23-.564l.618-.93Z" /></svg>
                  </button>
                </form>
              </div>
            </footer>
          </div>
        )}
      </>
    );
  }