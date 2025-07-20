# backend/services.py
import time
import logging
import asyncio
import json
from state_manager import redis_client  # Import the redis_client directly to save the summary

logger = logging.getLogger(__name__)

# --- Your Original Processing Logic, now in the services layer ---

def _validate_data_with_salesforce(request_data: dict) -> (bool, str):
    """Placeholder for synchronous validation logic."""
    logger.info(f"VALIDATING: Req ID {request_data.get('request_id')}")
    time.sleep(4) # Simulate network latency
    # Your original validation logic here...


    return True, f"Validation Successful for Req ID {request_data.get('request_id')}"

def _process_action_api_call(request_data: dict) -> (bool, str):
    """Placeholder for synchronous action logic."""
    logger.info(f"PROCESSING: Req ID {request_data.get('request_id')}")
    time.sleep(5) # Simulate action latency

    # Your original action logic here...
    users = request_data.get('users_info',)
    user_desc = ", ".join([u.get('email') or u.get('name', 'Unknown') for u in users])
    return True, f"Action Completed: Successfully processed request for {user_desc}."

async def validate_and_process_batch(session_id: str, batch_to_process: list):
    """
    An asynchronous generator that validates and processes a batch,
    yielding real-time status updates for the SSE stream.
    """
    validated_requests =[]
    validation_failures =[]
    action_successes =[]
    action_failures =[]
    
    # --- Validation Phase ---
    yield {"type": "phase", "status": "validation", "message": "Starting validation..."}
    for request in batch_to_process:
        req_id = request.get('request_id')
        yield {"type": "update", "request_id": req_id, "status": "validating"}
        
        # Run blocking I/O in a separate thread to not block the server
        is_valid, message = await asyncio.to_thread(_validate_data_with_salesforce, request)
        
        if is_valid:
            validated_requests.append(request)
            yield {"type": "update", "request_id": req_id, "status": "validation_success", "message": message}
        else:
            validation_failures.append(message)
            yield {"type": "update", "request_id": req_id, "status": "validation_failed", "message": message}

    # --- Processing Phase ---
    if not validated_requests:
        yield {"type": "phase", "status": "complete", "message": "No requests passed validation."}
        return

    yield {"type": "phase", "status": "processing", "message": "Starting processing for validated requests..."}
    for request in validated_requests:
        req_id = request.get('request_id')
        yield {"type": "update", "request_id": req_id, "status": "processing"}

        # Run blocking I/O in a separate thread
        success, message = await asyncio.to_thread(_process_action_api_call, request)

        if success:
            action_successes.append(message)
            yield {"type": "update", "request_id": req_id, "status": "action_success", "message": message}
        else:
            action_failures.append(message)
            yield {"type": "update", "request_id": req_id, "status": "action_failed", "message": message}

    # Create the final summary object and save it to Redis with a short expiry.
    final_summary = {
        "successes": action_successes,
        "validation_errors": validation_failures,
        "action_errors": action_failures
    }
    summary_key = f"session:{session_id}:last_summary"
    redis_client.set(summary_key, json.dumps(final_summary), ex=300) # Expire after 5 minutes
    logger.info(f"Saved final processing summary to Redis for session {session_id}")

    # Yield a final event to signal completion to the frontend.        
    yield {"type": "phase", "status": "complete", "message": "All processing finished."}