# RosterBot ✨

An intelligent, conversational AI assistant for streamlining complex user management tasks. RosterBot understands natural language, handles multiple requests in a single conversation, and reduces the manual effort and potential for errors in user administration.

Demo Video :

## About The Project

RosterBot is designed to be the front-end for operational user management, particularly for platforms like Salesforce or other internal systems. Instead of filling out complex forms, operators can simply talk to RosterBot in plain English (or use their voice) to add new users, update roles, or change user statuses across multiple networks or systems.

The bot intelligently gathers all required information, handles ambiguity, and presents a complete batch of tasks for confirmation before any action is taken, ensuring accuracy and efficiency.

### Core Features

* **Conversational Interface:** Interact with the bot using natural language.
* **Batch Processing:** Handles multiple distinct user management requests in a single conversation.
* **AI-Driven State Management:** Leverages GPT-4o to manage the conversational state, correctly identifying when it has enough information to proceed.
* **Voice-to-Text Input:** A microphone option allows users to speak their requests instead of typing.
* **Confirmation Step:** Always presents a clear summary of all pending actions for user confirmation before processing, preventing accidental changes.
* **Modern, Responsive UI:** A clean, Gemini-inspired interface built with Next.js and Tailwind CSS.

---

## Built With

This project is a full-stack application composed of a Python backend and a React/Next.js frontend.

**Backend:**
* [FastAPI](https://fastapi.tiangolo.com/) - High-performance Python web framework.
* [Redis](https://redis.io/) - In-memory data store for session and state management.
* [OpenAI GPT-4o](https://openai.com/gpt-4o/) - For natural language understanding and state management.
* [Pydantic](https://pydantic-docs.helpmanual.io/) - For data validation.

**Frontend:**
* [Next.js](https://nextjs.org/) - React framework for server-side rendering and static site generation.
* [React](https://reactjs.org/) - JavaScript library for building user interfaces.
* [Tailwind CSS](https://tailwindcss.com/) - A utility-first CSS framework for rapid UI development.
* [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) - For the voice-to-text feature.

---

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

Make sure you have the following installed on your system:

* **Node.js:** Version 18.17.0 or higher.
* **Python:** Version 3.10 or higher.
* **Redis:** The easiest way to run Redis is with Docker.
    ```sh
    docker run --name rosterbot-redis -p 6379:6379 -d redis
    ```
* **OpenAI API Key:** You need an API key from OpenAI to use the GPT-4o model.

### Installation & Setup

1.  **Clone the repository:**

2.  **Setup the Backend:**
    * Navigate to the `backend` directory:
        ```sh
        cd backend
        ```
    * Create and activate a Python virtual environment:
        ```sh
        # For Mac/Linux
        python3 -m venv venv
        source venv/bin/activate

        # For Windows
        python -m venv venv
        .\venv\Scripts\activate
        ```
    * Install the required Python packages:
        ```sh
        pip install -r requirements.txt
        ```
    * Create a `.env` file in the `backend` directory and add your OpenAI API key:
        ```
        api_key="sk-..."
        ```
    * Run the backend server:
        ```sh
        uvicorn main:app --host 0.0.0.0 --port 8000 
        ```
    Your backend should now be running on `http://localhost:8000`.

3.  **Setup the Frontend:**
    * Open a new terminal and navigate to the `frontend` directory:
        ```sh
        cd frontend
        ```
    * Install the required NPM packages:
        ```sh
        npm install
        ```
    * Run the frontend development server:
        ```sh
        npm run dev
        ```
    Your frontend should now be running on `http://localhost:3000`.

4.  **Open the App:**
    Open your browser and navigate to `http://localhost:3000` to start using RosterBot!

---