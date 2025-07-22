# backend/main.py
import openai
import json
import os
import logging
import uuid
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from enum import Enum, auto
from dotenv import load_dotenv
import asyncio


# Load environment variables from .env file
load_dotenv()

# Local imports
from System_Prompt import SYSTEM_PROMPT
import state_manager
import services
from auth import router as auth_router, get_current_user

# --- Configuration ---
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(name)s - %(message)s')
logger = logging.getLogger(__name__)
client = openai.OpenAI(api_key=os.getenv("api_key"))

app = FastAPI(title="User Management Bot API")

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # Allow frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Include the new authentication router ---
# This makes the /auth/login endpoint available
app.include_router(auth_router)

# --- State Machine (mirrors state_manager) ---
class BotState(Enum):
    GATHERING = auto()
    AWAITING_BATCH_CONFIRMATION = auto()
    AWAITING_CORRECTION_INPUT = auto() # Specifically waiting for user correction details
    PROCESSING_BATCH = auto() # Internal state during validation/action
    FINALIZING = auto() # Ready to ask concluding question
    PROCESSING = auto()
    ERROR = auto() # An unrecoverable error occurred


# --- Pydantic Models for Request/Response validation ---
class MessageRequest(BaseModel):
    text: str

class SessionResponse(BaseModel):
    session_id: str

# --- In-memory store for background task results (simple approach) ---
# For multi-worker production, a more robust solution like Redis Pub/Sub would be needed.
processing_streams = {}

# --- API Endpoints ---

@app.post("/sessions", response_model=SessionResponse, status_code=201)
async def create_session(current_user: dict = Depends(get_current_user)):
    """
    Creates a new chat session, now associated with the logged-in user.
    This endpoint is now protected and requires a valid token.
    """
    user_email = current_user.get("email")
    session_id = str(uuid.uuid4())
    state = state_manager.load_state(session_id) # Creates a new default state
    state["user_email"] = user_email # Associate session with user
    state_manager.save_state(session_id, state)
    logger.info(f"New session created: {session_id} for user: {user_email}")
    return {"session_id": session_id, "user_email": user_email}


@app.delete("/sessions/{session_id}", status_code=204)
async def end_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Deletes a session. Protected endpoint."""
    state = state_manager.load_state(session_id)
    if state.get("user_email") != current_user.get("email"):
         raise HTTPException(status_code=403, detail="Not authorized to delete this session")
    
    state_manager.delete_session(session_id)
    if session_id in processing_streams:
        del processing_streams[session_id]
    logger.info(f"Session {session_id} deleted by user {current_user.get('email')}")
    return

@app.post("/sessions/{session_id}/messages")
async def post_message(session_id: str, message: MessageRequest,current_user: dict = Depends(get_current_user)):
    """Handles a regular user message in the conversation."""
    state = state_manager.load_state(session_id)

    # Security check: ensure the user accessing the session is the one who created it
    if state.get("user_email") != current_user.get("email"):
        raise HTTPException(status_code=403, detail="Not authorized to access this session")
    
    current_bot_state = state["current_bot_state"]
    conversation_history = state["conversation_history"]
    active_requests_batch = state["active_requests_batch"]


    # --- THIS IS THE KEY ADDITION ---
    # Handle the special trigger from the frontend to generate the final summary
    if message.text == "ACTION:SUMMARIZE_RESULTS":
        logger.info(f"Received trigger for final summary for session {session_id}")
        summary_key = f"session:{session_id}:last_summary"
        summary_json = state_manager.redis_client.get(summary_key)
        
        if not summary_json:
            ai_response_data = {"ai_response": "An Error Occured. Please try again"}
            state["current_bot_state"] = BotState.FINALIZING
            state_manager.save_state(session_id, state)
            return ai_response_data

        summary_data = json.loads(summary_json)
        
        summary_text = "Processing is complete.\n"
        if summary_data.get("successes"):
            summary_text += "\nSuccessful Actions:\n- " + "\n- ".join(summary_data["successes"])
        if summary_data.get("action_errors"): # Handling the action failure case (if request failed during performing action)
            summary_text+=(f"Unfortunately, the following actions failed:\n- " + "\n- ".join(summary_data["action_errors"]))
        if summary_data.get("validation_errors"):
            summary_text += "\n\nValidation Errors:\n- " + "\n- ".join(summary_data["validation_errors"])

        context_msg = (
            f"CONTEXT: You have just finished processing a batch. Here is the result:\n{summary_text}\n\n"
            "Your task is to present this summary to the user in a clear, friendly, conversational way. "
            "Acknowledge any failures directly but maintain a helpful tone. Thank the user for visiting."
        )
        state["conversation_history"].append({"role": "system", "content": context_msg})
        state["current_bot_state"] = BotState.FINALIZING
        # FIX: Clear the batch after processing to prevent incorrect confirmations
        state["active_requests_batch"] = []
        state_manager.redis_client.delete(summary_key) # Clean up summary from Redis
    else:
        state["conversation_history"].append({"role": "user", "content": message.text})
        

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=state["conversation_history"],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        ai_json_str = response.choices[0].message.content
        ai_data = json.loads(ai_json_str)
        
        state["conversation_history"].append({"role": "assistant", "content": ai_json_str})
        state["active_requests_batch"] = ai_data.get("requests_in_batch",state["active_requests_batch"])
        if ai_data.get("batch_status", {}).get("awaiting_batch_confirmation"):
            state["current_bot_state"] = BotState.AWAITING_BATCH_CONFIRMATION
        # else:
        #     state["current_bot_state"] = BotState.GATHERING

        state_manager.save_state(session_id, state)
        return ai_data

    except Exception as e:
        logger.error(f"Error in OpenAI call for session {session_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error communicating with AI service.")

@app.post("/sessions/{session_id}/process-batch", status_code=202)
async def process_batch(session_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """
    Accepts the request to process a batch and starts it as a background task.
    Returns immediately so the UI does not freeze.
    """
    state = state_manager.load_state(session_id)

    if state.get("user_email") != current_user.get("email"):
        raise HTTPException(status_code=403, detail="Not authorized to process this batch")
    
    batch_to_process = state.get("active_requests_batch",)
    
    if not batch_to_process:
        raise HTTPException(status_code=400, detail="No active batch to process.")

    # A simple way to pass the generator to the streaming endpoint
    processing_streams[session_id] = services.validate_and_process_batch(session_id, batch_to_process)
    state["current_bot_state"] = BotState.PROCESSING
    state_manager.save_state(session_id, state)
    return {"message": "Batch processing started."}
    

@app.get("/sessions/{session_id}/process-batch/status")
async def get_batch_status(session_id: str, current_user: dict = Depends(get_current_user)):
    state = state_manager.load_state(session_id)
    if state.get("user_email") != current_user.get("email"):
        raise HTTPException(status_code=403, detail="Not authorized to view this status")
    
    if session_id not in processing_streams:
        raise HTTPException(status_code=404, detail="No active processing stream found for this session.")

    async def event_stream():
        generator = processing_streams.pop(session_id, None)
        if not generator: return
        try:
            async for event in generator:
                yield f"data: {json.dumps(event)}\n\n"
        finally:
            logger.debug(f"SSE stream for session {session_id} has ended.")
            if session_id in processing_streams:
                del processing_streams[session_id]

    return StreamingResponse(event_stream(), media_type="text/event-stream")