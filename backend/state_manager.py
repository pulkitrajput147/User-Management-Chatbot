# backend/state_manager.py
import redis
import json
import logging
from enum import Enum,auto
from System_Prompt import SYSTEM_PROMPT

logger = logging.getLogger(__name__)


try:
    redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
    redis_client.ping()
    logger.info("State Manager connected to Redis.")
except redis.exceptions.ConnectionError as e:
    logger.critical(f"State Manager could not connect to Redis: {e}")
    raise


# This should match the Enum in main.py
class BotState(Enum):
    GATHERING = auto()
    AWAITING_BATCH_CONFIRMATION = auto()
    AWAITING_CORRECTION_INPUT = auto() # Specifically waiting for user correction details
    PROCESSING_BATCH = auto() # Internal state during validation/action
    FINALIZING = auto() # Ready to ask concluding question
    PROCESSING = auto()
    ERROR = auto() # An unrecoverable error occurred

def load_state(session_id: str) -> dict:
    """
    Loads a user's session state from Redis using their unique session_id.
    If no state is found, it creates a fresh, default state.
    """
    state_json = redis_client.get(f"session:{session_id}")
    if state_json:
        logger.debug(f"Loaded existing state for session_id: {session_id}")
        state = json.loads(state_json)
        state['current_bot_state'] = BotState[state['current_bot_state']]
        return state
    else:
        # Return a fresh, default state for a new session
        logger.debug(f"No state found for session_id: {session_id}. Creating new state.")
        return {
            "conversation_history": [{"role": "system", "content": SYSTEM_PROMPT}],
            "active_requests_batch": [],
            "processed_results_summary": [],
            "current_bot_state": BotState.GATHERING,
            "user_email": None  # *** This line is added to support authentication ***
        }

def save_state(session_id: str, state: dict):
    """Saves a user's session state to Redis."""
    logger.debug(f"Saving state for session_id: {session_id}")
    state_to_save = state.copy()
    
    state_to_save['current_bot_state'] = state['current_bot_state'].name  # Convert the Enum member to its string name for JSON serialization.
    
    redis_client.set(f"session:{session_id}", json.dumps(state_to_save), ex=7200) # Expire after 2 hours

def delete_session(session_id: str):
    """Deletes all keys associated with a session."""
    redis_client.delete(f"session:{session_id}")
    logger.info(f"Deleted session: {session_id}")