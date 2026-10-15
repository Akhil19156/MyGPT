# MyGPT React frontend

## Requirements
- Node.js and npm
- MyGPT FastAPI backend running on `http://localhost:8080`

## Run
From this folder:
```powershell
npm install
npm run dev
```
Open `http://localhost:5173`.

The Vite development server proxies `/conversations`, `/history`, `/upload`, and `/chat` to the backend at port 8080. This avoids needing CORS changes for local development.

## Backend API assumptions
This frontend expects:
- `GET /conversations`
- `GET /history/{thread_id}`
- `POST /upload` using multipart fields `file` and `thread_id`
- `POST /chat/stream` using JSON `{ "message": "...", "thread_id": "...", "model": "..." }`
and SSE events in the form `data: {"token":"..."}` and `data: {"done":true}`.

The React UI replaces the HTML template frontend; the FastAPI routes and agent code remain in Python.
