import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader2, ChevronRight, Star, TrendingUp, Lightbulb, ThumbsUp, AlertTriangle, MessageSquare } from 'lucide-react';
import axios from 'axios';

const FALLBACK_AGENT_ID = process.env.REACT_APP_BEY_AGENT_ID || "2ef7b57b-ab28-49e8-82ae-5b16b6baa399";
const FALLBACK_AVATAR_URL = `https://bey.chat/agent/${FALLBACK_AGENT_ID}`;

const DEFAULT_QUESTIONS = [
  "On a scale of 1 to 10, how clear and well-structured was the course material? Please explain your rating.",
  "What was the single most valuable concept or skill you gained from this course?",
  "What topics or improvements would you like to see added in future versions of this course?"
];

/* ── Sentiment badge ── */
const SentimentBadge = ({ sentiment }) => {
  const map = {
    positive: { color: '#10b981', bg: 'rgba(16,185,129,0.15)', label: '😊 Positive' },
    neutral:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  label: '😐 Neutral'  },
    negative: { color: '#f87171', bg: 'rgba(248,113,113,0.15)', label: '😟 Negative' },
  };
  const s = map[sentiment] || map.neutral;
  return (
    <span style={{ color: s.color, background: s.bg, padding: '4px 14px', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600, border: `1px solid ${s.color}33` }}>
      {s.label}
    </span>
  );
};

/* ── Score ring ── */
const ScoreRing = ({ score, label }) => {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? '#10b981' : score >= 5 ? '#f59e0b' : '#f87171';
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="90" height="90" viewBox="0 0 90 90">
        <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
        <circle cx="45" cy="45" r="38" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${2 * Math.PI * 38}`}
          strokeDashoffset={`${2 * Math.PI * 38 * (1 - pct / 100)}`}
          strokeLinecap="round"
          transform="rotate(-90 45 45)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x="45" y="49" textAnchor="middle" fill="white" fontSize="18" fontWeight="700">{score?.toFixed(1)}</text>
      </svg>
      <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>{label}</p>
    </div>
  );
};

/* ═══════════════════════════ REPORT PAGE ═══════════════════════════ */
const ReportPage = ({ report, formData }) => {
  const sentimentColor = report.sentiment === 'positive' ? '#10b981' : report.sentiment === 'negative' ? '#f87171' : '#f59e0b';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="report-page">
      {/* Header */}
      <div className="report-header">
        <div className="report-header-inner">
          <CheckCircle size={32} color="#10b981" />
          <div>
            <h1 className="report-title">Feedback Report</h1>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
              {formData.name} &nbsp;·&nbsp; {formData.email} &nbsp;·&nbsp; {formData.phone}
            </p>
          </div>
          <SentimentBadge sentiment={report.sentiment} />
        </div>
      </div>

      <div className="report-body">
        {/* Score Row */}
        <div className="report-card score-row">
          <ScoreRing score={report.clarity_score} label="Clarity Score" />
          <div className="score-divider" />
          <ScoreRing score={report.overall_score} label="Overall Score" />
          <div className="score-divider" />
          <div style={{ flex: 1 }}>
            <p className="section-label"><Star size={14} /> AI Summary</p>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: '#e2e8f0' }}>{report.summary}</p>
          </div>
        </div>

        <div className="report-two-col">
          {/* Strengths */}
          <div className="report-card">
            <p className="section-label"><ThumbsUp size={14} /> Strengths</p>
            <ul className="report-list green">
              {(report.strengths || []).map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>

          {/* Areas for improvement */}
          <div className="report-card">
            <p className="section-label"><AlertTriangle size={14} /> Areas for Improvement</p>
            <ul className="report-list amber">
              {(report.areas_for_improvement || []).map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        </div>

        {/* Key Themes */}
        <div className="report-card">
          <p className="section-label"><TrendingUp size={14} /> Key Themes</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {(report.key_themes || []).map((t, i) => (
              <span key={i} className="theme-chip">{t}</span>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="report-card">
          <p className="section-label"><Lightbulb size={14} /> Recommendations</p>
          <ol className="report-ol">
            {(report.recommendations || []).map((r, i) => <li key={i}>{r}</li>)}
          </ol>
        </div>

        {/* Responses */}
        <div className="report-card">
          <p className="section-label"><MessageSquare size={14} /> Recorded Responses</p>
          {[
            { label: "Q1 · Course Clarity",       text: report.answers.q1 },
            { label: "Q2 · Most Valuable Concept", text: report.answers.q2 },
            { label: "Q3 · Suggestions",           text: report.answers.q3 },
          ].map((item, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{item.label}</p>
              <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.6, background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
        <button className="btn" style={{ maxWidth: 260, margin: '0 auto' }} onClick={() => window.location.reload()}>
          Submit Another Response
        </button>
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════ AVATAR STEP ═══════════════════════════ */
const AvatarStep = ({ formData }) => {
  const [step, setStep]               = useState(0);
  const [answers, setAnswers]         = useState({ q1: '', q2: '', q3: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [report, setReport]           = useState(null);
  const [error, setError]             = useState(null);
  const [iframeKey, setIframeKey]     = useState(Date.now());
  const [avatarUrl, setAvatarUrl]     = useState(FALLBACK_AVATAR_URL);
  const keys = ['q1', 'q2', 'q3'];

  /* On mount: update the Beyond Presence agent system prompt */
  useEffect(() => {
    axios.post('http://localhost:8000/api/prepare-session', { name: formData.name })
      .then(res => {
        if (res.data.avatar_chat_url) setAvatarUrl(res.data.avatar_chat_url);
        // Reload iframe so avatar picks up new prompt
        setIframeKey(Date.now());
      })
      .catch(() => { /* keep defaults */ });
  }, [formData.name]);

  const handleNext = () => {
    if (!answers[keys[step]].trim()) return;
    if (step < 2) { setStep(s => s + 1); return; }
    handleSubmit();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await axios.post('http://localhost:8000/api/feedback', {
        name:  formData.name,
        email: formData.email,
        phone: formData.phone,
        q1_clarity:    answers.q1,
        q2_impact:     answers.q2,
        q3_suggestions: answers.q3,
      });
      setReport(res.data.report);
    } catch (e) {
      console.error(e);
      setError('Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (report) return <ReportPage report={report} formData={formData} />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="feedback-layout">

      {/* ── Left: Avatar ── */}
      <div className="avatar-panel">
        <div className="avatar-live-badge">
          <span className="dot" />
          AI Interviewer — Live
        </div>
        <iframe
          key={iframeKey}
          src={avatarUrl}
          title="Beyond Presence AI Avatar"
          allow="camera; microphone; autoplay; fullscreen"
          allowFullScreen
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
      </div>

      {/* ── Right: Questions ── */}
      <div className="questions-panel">
        {/* Progress */}
        <div className="q-header">
          <p className="q-meta">Session for <strong>{formData.name}</strong></p>
          <div className="progress-bar-wrap">
            <motion.div className="progress-bar-fill"
              animate={{ width: `${((step + 1) / 3) * 100}%` }}
              transition={{ duration: 0.4 }} />
          </div>
          <p className="q-counter">Question {step + 1} of 3</p>
        </div>

        {/* Instruction */}
        <div className="q-instruction">
          <span>💬</span>
          <p>Listen to the avatar and type your response below. The website will only record your answers.</p>
        </div>

        {/* Animated question + textarea */}
        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="q-body">
            <span className="q-chip">
              {`Answer ${step + 1}`}
            </span>
            <h2 className="q-question">Type what you answered to the avatar.</h2>
            <textarea
              className="q-textarea"
              rows={5}
              placeholder="Type the answer you gave to the avatar..."
              value={answers[keys[step]]}
              onChange={e => setAnswers(prev => ({ ...prev, [keys[step]]: e.target.value }))}
              autoFocus
            />
          </motion.div>
        </AnimatePresence>

        {error && <p className="q-error">{error}</p>}

        <button className="btn q-btn"
          disabled={!answers[keys[step]].trim() || isSubmitting}
          onClick={handleNext}>
          {isSubmitting
            ? <span className="btn-inner"><Loader2 size={18} className="spin" /> Generating Report…</span>
            : <span className="btn-inner">
                {step === 2 ? 'Generate Feedback Report' : 'Next Question'}
                <ChevronRight size={18} />
              </span>
          }
        </button>
      </div>
    </motion.div>
  );
};

export default AvatarStep;
