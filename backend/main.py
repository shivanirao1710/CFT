import os
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import json
import httpx
from urllib.parse import urlparse
from groq import Groq
from dotenv import load_dotenv

from database import engine, SessionLocal, FeedbackRecord, init_db, get_db

load_dotenv()

app = FastAPI(title="CFT Feedback Backend")

# Initialize DB on startup
@app.on_event("startup")
def startup():
    init_db()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
BEY_AGENT_ID = os.getenv("BEY_AGENT_ID", "").strip()
BEY_EMBED_URL = os.getenv("BEY_EMBED_URL", "").strip()
BEY_API_KEY = os.getenv("BEY_API_KEY", "").strip()
AUTO_AGENT_NAME_PREFIX = "Mantrika"
AUTO_AGENT_NAME = "Mantrika"
AUTO_AGENT_PROMPT = """
You are Mantrika, the CFT AI Assistant.

Follow this exact conversation flow:
1) Opening line:
"We value your feedback—and I’m very sure you have one."

2) Ask these questions exactly, one by one:
Q1: "What is one insight or idea from today’s CFT inauguration that universities must immediately adopt to stay relevant in the AI era?"
Q2: "What do you see as the biggest gap between universities and industry today—and how can CFT help bridge it?"
Q3: "If CFT is implemented successfully, what kind of student or graduate should it ideally produce in the next 3–5 years?"
Q4: "How would you like to partner with the Center for Future Technology at Best Innovation University campus?"

3) Closing line:
"Thank you! Your insights will help shape the future of education, innovation, and talent."

Rules:
- Keep tone warm and professional.
- Do not skip or reword questions.
- Wait for user response before asking the next question.
""".strip()
AUTO_AGENT_GREETING = "We value your feedback—and I’m very sure you have one."

# Helper to process feedback with Groq
def process_feedback_transcript(transcript: str):
    prompt = f"""
    The following is a conversation transcript from an AI Avatar feedback session.
    Extract the exact answers to the following 4 questions from the transcript.
    If a question was not answered, return "Not provided".
    
    Questions:
    1. Experience & Relevance: "What is one insight or idea from today’s CFT inauguration that universities must immediately adopt to stay relevant in the AI era?"
    2. Industry–Academia Gap: "What do you see as the biggest gap between universities and industry today—and how can CFT help bridge it?"
    3. Future Impact: "If CFT is implemented successfully, what kind of student or graduate should it ideally produce in the next 3–5 years?"
    4. Partnership & Collaboration: "How would you like to partner with the Center for Future Technology at Best Innovation University campus?"

    Summarize the overall feedback in a professional and concise manner (2-3 sentences).

    Return the result in JSON format with keys: "q1", "q2", "q3", "q4", "summary".

    Transcript:
    \"\"\"
    {transcript}
    \"\"\"
    """
    
    response = groq_client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model="llama-3.3-70b-versatile",
        response_format={"type": "json_object"}
    )
    
    return json.loads(response.choices[0].message.content)

@app.post("/api/feedback/start")
def start_feedback(data: dict, db: Session = Depends(get_db)):
    name = data.get("name")
    email = data.get("email")
    phone = data.get("phone")
    
    if not name or not email:
        raise HTTPException(status_code=400, detail="Name and Email are required")
    
    feedback = FeedbackRecord(name=name, email=email, phone=phone)
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    
    # Return the ID so frontend can redirect to Beyond Presence with externalId
    return {"id": feedback.id, "message": "Initial feedback record created"}

@app.post("/api/feedback/webhook")
async def beyond_presence_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.json()
    
    # 1. Flexible ID extraction from payload or metadata
    metadata = payload.get("metadata", {})
    external_id = payload.get("externalId") or metadata.get("externalId")
    
    # 2. Support for different transcript formats (raw text or message arrays)
    transcript = payload.get("transcript") or payload.get("conversation", {}).get("transcript")
    if not transcript:
        # Fallback to reconstructing from messages if raw transcript isn't provided
        messages = payload.get("messages", []) or payload.get("data", {}).get("messages", [])
        if messages:
            transcript = "\n".join([f"{m.get('role', 'unknown')}: {m.get('content', '')}" for m in messages])

    if not transcript or not external_id:
        return {"status": "incomplete_data", "received_id": external_id}

    # 3. Process and save findings
    feedback = db.query(FeedbackRecord).filter(FeedbackRecord.id == int(external_id)).first()
    if feedback:
        feedback.transcript = transcript
        try:
            # Analyze the transcript using your Groq integration
            extracted = process_feedback_transcript(transcript)
            feedback.q1_insight = extracted.get("q1")
            feedback.q2_gap = extracted.get("q2")
            feedback.q3_future_impact = extracted.get("q3")
            feedback.q4_partnership = extracted.get("q4")
            feedback.summary = extracted.get("summary")
            db.commit()
            return {"status": "success"}
        except Exception as e:
            print(f"Error processing transcript: {e}")
            return {"status": "processing_error"}
            
    return {"status": "record_not_found"}

@app.get("/api/feedbacks")
def list_feedbacks(db: Session = Depends(get_db)):
    return db.query(FeedbackRecord).order_by(FeedbackRecord.created_at.desc()).all()

def _extract_id_from_embed_url(embed_url: str):
    if not embed_url:
        return ""
    try:
        parsed = urlparse(embed_url)
        parts = [p for p in parsed.path.split("/") if p]
        return parts[0] if parts else ""
    except Exception:
        return ""

def _resolve_bey_embed():
    # Prefer explicit embed URL if provided.
    configured_url = BEY_EMBED_URL or (f"https://bey.chat/{BEY_AGENT_ID}" if BEY_AGENT_ID else "")
    if not configured_url:
        return {"embed_url": "", "status": "missing_configuration"}

    candidate_id = _extract_id_from_embed_url(configured_url) or BEY_AGENT_ID
    if not candidate_id or not BEY_API_KEY:
        return {"embed_url": configured_url, "status": "unchecked"}

    try:
        with httpx.Client(timeout=8.0) as client:
            # Validate current ID as a real agent ID.
            agent_resp = client.get(
                f"https://api.bey.dev/v1/agents/{candidate_id}",
                headers={"x-api-key": BEY_API_KEY},
            )
            if agent_resp.status_code == 200:
                agent_data = agent_resp.json()
                avatar_id = agent_data.get("avatar_id")
                if avatar_id:
                    # Keep the configured agent synced to the required CFT script and name.
                    _ = client.put(
                        f"https://api.bey.dev/v1/agents/{candidate_id}",
                        headers={"x-api-key": BEY_API_KEY, "Content-Type": "application/json"},
                        json={
                            "name": AUTO_AGENT_NAME,
                            "avatar_id": avatar_id,
                            "system_prompt": AUTO_AGENT_PROMPT,
                            "greeting": AUTO_AGENT_GREETING,
                        },
                    )
                return {"embed_url": f"https://bey.chat/{candidate_id}", "status": "valid_agent_id"}
            agents_resp = client.get(
                "https://api.bey.dev/v1/agents?limit=50",
                headers={"x-api-key": BEY_API_KEY},
            )
            if agents_resp.status_code == 200:
                agents = agents_resp.json().get("data", [])
                # If candidate is an avatar ID, try to reuse an existing agent with that avatar.
                matched = next((a for a in agents if a.get("avatar_id") == candidate_id), None)
                if matched and matched.get("id"):
                    # Ensure reused agent follows the expected script.
                    _ = client.put(
                        f"https://api.bey.dev/v1/agents/{matched['id']}",
                        headers={"x-api-key": BEY_API_KEY, "Content-Type": "application/json"},
                        json={
                            "name": AUTO_AGENT_NAME,
                            "avatar_id": candidate_id,
                            "system_prompt": AUTO_AGENT_PROMPT,
                            "greeting": AUTO_AGENT_GREETING,
                        },
                    )
                    return {
                        "embed_url": f"https://bey.chat/{matched['id']}",
                        "status": "resolved_from_avatar_id",
                    }

                # If no agent exists for this avatar, create one dynamically.
                create_resp = client.post(
                    "https://api.bey.dev/v1/agents",
                    headers={"x-api-key": BEY_API_KEY, "Content-Type": "application/json"},
                    json={
                        "name": AUTO_AGENT_NAME,
                        "avatar_id": candidate_id,
                        "system_prompt": AUTO_AGENT_PROMPT,
                        "greeting": AUTO_AGENT_GREETING,
                    },
                )
                if create_resp.status_code in (200, 201):
                    created = create_resp.json()
                    created_id = created.get("id")
                    if created_id:
                        return {
                            "embed_url": f"https://bey.chat/{created_id}",
                            "status": "created_agent_from_avatar_id",
                        }

            # If this API key cannot retrieve or create, keep configured URL as fallback.
            if agent_resp.status_code in (401, 403, 404):
                return {"embed_url": configured_url, "status": "unverified_access"}
    except Exception:
        return {"embed_url": configured_url, "status": "validation_failed"}

    return {"embed_url": configured_url, "status": "unverified_access"}

@app.get("/api/config")
def get_public_config():
    bey_resolution = _resolve_bey_embed()
    return {
        "beyAgentId": BEY_AGENT_ID,
        "beyEmbedUrl": BEY_EMBED_URL,
        "resolvedEmbedUrl": bey_resolution.get("embed_url", ""),
        "agentStatus": bey_resolution.get("status", "unchecked"),
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

