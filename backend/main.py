from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import json

import models
from database import engine, get_db
from analysis import analyze_feedback
from avatar_agent import update_agent_for_user, QUESTIONS

# Create tables on startup
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="CFT Feedback API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Schemas ─────────────────────────────────────────────────────────────────

class PrepareRequest(BaseModel):
    name: str

class FeedbackCreate(BaseModel):
    name: str
    email: str
    phone: str
    q1_clarity: str
    q2_impact: str
    q3_suggestions: str

# ─── Routes ──────────────────────────────────────────────────────────────────

@app.post("/api/prepare-session")
def prepare_session(data: PrepareRequest):
    """
    Called right after registration.
    Updates the Beyond Presence agent system prompt with the user's name
    so the avatar greets them personally and asks the 3 questions in order.
    Also returns the 3 questions so the frontend can show them as hints.
    """
    updated, agent_id, chat_url = update_agent_for_user(data.name)
    return {
        "agent_updated": updated,
        "agent_id": agent_id,
        "avatar_chat_url": chat_url,
        "questions": QUESTIONS,
    }


@app.post("/api/feedback")
def submit_feedback(data: FeedbackCreate, db: Session = Depends(get_db)):
    """Submit answers, run Groq analysis, store to PostgreSQL, return report."""
    report = analyze_feedback(
        data.name, data.q1_clarity, data.q2_impact, data.q3_suggestions
    )

    feedback = models.UserFeedback(
        name=data.name,
        email=data.email,
        phone=data.phone,
        q1_clarity=data.q1_clarity,
        q2_impact=data.q2_impact,
        q3_suggestions=data.q3_suggestions,
        sentiment=report.get("sentiment", "neutral"),
        clarity_score=report.get("clarity_score", 5.0),
        overall_score=report.get("overall_score", 5.0),
        key_themes=", ".join(report.get("key_themes", [])),
        recommendations=json.dumps(report.get("recommendations", [])),
        full_analysis=report.get("summary", ""),
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    return {
        "status": "success",
        "report": {
            "id": feedback.id,
            "name": feedback.name,
            "email": feedback.email,
            "sentiment": feedback.sentiment,
            "clarity_score": feedback.clarity_score,
            "overall_score": feedback.overall_score,
            "key_themes": report.get("key_themes", []),
            "recommendations": report.get("recommendations", []),
            "strengths": report.get("strengths", []),
            "areas_for_improvement": report.get("areas_for_improvement", []),
            "summary": feedback.full_analysis,
            "answers": {
                "q1": data.q1_clarity,
                "q2": data.q2_impact,
                "q3": data.q3_suggestions,
            }
        }
    }


@app.get("/api/feedbacks")
def list_feedbacks(db: Session = Depends(get_db)):
    """Return all stored feedback records (admin use)."""
    records = db.query(models.UserFeedback).order_by(models.UserFeedback.created_at.desc()).all()
    return records
