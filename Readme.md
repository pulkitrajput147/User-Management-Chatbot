user-management-bot/
├── backend/
│   ├──.env
│   ├── main.py             # FastAPI application, endpoints
│   ├── services.py         # Core business logic (batch processing)
│   ├── state_manager.py    # Redis interaction logic
│   ├── System_Prompt.py
│   └── requirements.txt
│
└── frontend/
    ├── components/
    │   ├── BatchConfirmation.js
    │   ├── Message.js
    │   └── StatusDashboard.js
    ├── pages/
    │   ├── _app.js
    │   └── index.js
    ├── styles/
    │   └── globals.css
    ├── package.json
    └── tailwind.config.js


Backend :

Step 1 : Run Docker
    docker run --name user-bot-redis -p 6379:6379 -d redis

Step 2 : Run Backend
Command to run backend = uvicorn main:app --host 0.0.0.0 --port 8000 --reload



Frontend :

Step 1 : npm install

Step 2 : npm run dev