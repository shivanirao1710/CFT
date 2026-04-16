import React, { useState } from 'react';
import './App.css';

function App() {
  const API_BASE_URL = 'http://localhost:8000';
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [view, setView] = useState('dashboard');
  const [feedbacks, setFeedbacks] = useState([]);
  const [stats, setStats] = useState({ total: 0 });
  const [showAvatar, setShowAvatar] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [beyAgentId, setBeyAgentId] = useState('');
  const [beyEmbedUrl, setBeyEmbedUrl] = useState('');
  const [resolvedEmbedUrl, setResolvedEmbedUrl] = useState('');
  const [agentStatus, setAgentStatus] = useState('unchecked');

  React.useEffect(() => {
    fetchStats();
    if (view === 'feedback') {
      fetchFeedbacks();
    }
  }, [view]);

  React.useEffect(() => {
    fetchConfig();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/feedbacks`);
      const data = await response.json();
      setStats({ total: data.length });
    } catch (e) {
      console.log('Backend not reachable yet');
    }
  };

  const fetchFeedbacks = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/feedbacks`);
      const data = await response.json();
      setFeedbacks(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/config`);
      if (!response.ok) throw new Error('Unable to fetch config');
      const data = await response.json();
      setBeyAgentId((data?.beyAgentId || '').trim());
      setBeyEmbedUrl((data?.beyEmbedUrl || '').trim());
      setResolvedEmbedUrl((data?.resolvedEmbedUrl || '').trim());
      setAgentStatus((data?.agentStatus || 'unchecked').trim());
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/feedback/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to start feedback');
      
      const result = await response.json();
      setCurrentSessionId(result.id);
      setShowAvatar(true);
      setSubmitted(true);

    } catch (error) {
      console.error('Error:', error);
      alert('There was an error connecting to the server. Please check if the backend is running.');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const withMetadata = (baseUrl) => {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}metadata=${encodeURIComponent(
      JSON.stringify({ externalId: currentSessionId })
    )}`;
  };

  const avatarUrl = resolvedEmbedUrl
    ? withMetadata(resolvedEmbedUrl)
    : beyEmbedUrl
      ? withMetadata(beyEmbedUrl)
    : beyAgentId
      ? withMetadata(`https://bey.chat/${beyAgentId}`)
      : '';

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-color)' }}>CFT EVENT</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Dashboard Panel</p>
        </div>
        
        <nav>
          <button onClick={() => setView('dashboard')} className={`nav-item-btn ${view === 'dashboard' ? 'active' : ''}`}>
            <span>📊</span> Dashboard
          </button>
          <button onClick={() => setView('feedback')} className={`nav-item-btn ${view === 'feedback' ? 'active' : ''}`}>
            <span>📝</span> All Feedback
          </button>
          <a href="#" className="nav-item">
            <span>⚙️</span> Settings
          </a>
        </nav>

        <div style={{ marginTop: 'auto', padding: '1rem', background: 'var(--input-bg)', borderRadius: '12px' }}>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Version 2.4.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="welcome-section">
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Welcome back,</p>
            <h1>{view === 'dashboard' ? 'Event Insights' : 'Feedback Records'}</h1>
          </div>
          <div className="stats-grid">
            <div className="card stat-card">
              <div className="stat-label">Total Responses</div>
              <div className="stat-value">{stats.total}</div>
            </div>
          </div>
        </header>

        {view === 'dashboard' ? (
          <section style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem' }}>
            {/* Form Card */}
            <div className="card">
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Submit New Feedback</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Enter attendee details to start AI Avatar session.</p>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    name="name"
                    placeholder="e.g. Alex Rivera" 
                    className="input-field"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    name="email"
                    placeholder="alex@example.com" 
                    className="input-field"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Phone Number</label>
                  <input 
                    type="tel" 
                    name="phone"
                    placeholder="+91 99887 76655" 
                    className="input-field"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </div>

                <button type="submit" className="submit-btn" disabled={submitted}>
                  {submitted ? '✅ Redirecting...' : 'Give Feedback'}
                </button>
              </form>
            </div>

            {/* Branding/Visual Card */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="branding-box">
                <img src="/cft_event_branding_1776315501011.png" alt="CFT Event Branding" />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ marginBottom: '1rem' }}>Avatar Questions</h4>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  "We value your feedback-and I'm very sure you have one."
                </p>
                <ul style={{ listStyle: 'none', padding: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  <li style={{ marginBottom: '0.5rem' }}>
                    1. What is one insight or idea from today's CFT inauguration that universities must immediately adopt to stay relevant in the AI era?
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    2. What do you see as the biggest gap between universities and industry today-and how can CFT help bridge it?
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    3. If CFT is implemented successfully, what kind of student or graduate should it ideally produce in the next 3-5 years?
                  </li>
                  <li>
                    4. How would you like to partner with the Center for Future Technology at Best Innovation University campus?
                  </li>
                </ul>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.85rem', marginTop: '1rem' }}>
                  "Thank you! Your insights will help shape the future of education, innovation, and talent."
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="feedback-list">
            {feedbacks.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
                <p>No feedback recorded yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {feedbacks.map(fb => (
                  <div key={fb.id} className="card feedback-card shine-effect">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                      <div>
                        <h3 style={{ margin: 0, color: 'var(--accent-color)' }}>{fb.name}</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{fb.email} • {fb.phone}</p>
                      </div>
                      <span className="date-tag">{new Date(fb.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    {fb.summary ? (
                      <div className="summary-section">
                        <div className="ai-badge">AI SUMMARY</div>
                        <p style={{ fontSize: '1rem', lineHeight: '1.6', marginBottom: '1.5rem', color: '#fff' }}>{fb.summary}</p>
                        
                        <div className="q-grid">
                          <div className="q-item">
                            <label>Experience/Insight</label>
                            <p>{fb.q1_insight}</p>
                          </div>
                          <div className="q-item">
                            <label>Industry-Academia Gap</label>
                            <p>{fb.q2_gap}</p>
                          </div>
                          <div className="q-item">
                            <label>Future Impact</label>
                            <p>{fb.q3_future_impact}</p>
                          </div>
                          <div className="q-item">
                            <label>Partnership Idea</label>
                            <p>{fb.q4_partnership}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', textAlign: 'center' }}>
                         <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                          Conversation in progress or awaiting avatar response...
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Embedded Avatar Modal */}
      
      {showAvatar && (
        <div className="avatar-modal-overlay">
          <div className="avatar-modal-container">
            <div className="avatar-header">
              <h3>CFT AI Assistant</h3>
              <button 
                className="close-modal-btn" 
                onClick={() => {
                  setShowAvatar(false);
                  setFormData({ name: '', email: '', phone: '' });
                  setSubmitted(false);
                  fetchStats();
                }}
              >
                ✕ Close
              </button>
            </div>
            <div className="avatar-iframe-wrapper">
              {avatarUrl ? (
                <iframe
                  src={avatarUrl}
                  title="Beyond Presence Avatar"
                  allow="camera; microphone; autoplay; encrypted-media"
                  className="avatar-iframe"
                />
              ) : (
                <div className="avatar-config-warning">
                  <h4>Avatar agent is not configured</h4>
                  <p>
                    Add <code>BEY_AGENT_ID=&lt;your-agent-id&gt;</code> in backend <code>.env</code>,
                    or set <code>BEY_EMBED_URL=&lt;full-embed-url&gt;</code>, restart the backend, then try again.
                  </p>
                </div>
              )}
            </div>
            {agentStatus === 'resolved_from_avatar_id' && (
              <div className="avatar-status-banner success">
                Detected avatar ID. Automatically mapped to a live agent for this session.
              </div>
            )}
            {agentStatus === 'created_agent_from_avatar_id' && (
              <div className="avatar-status-banner success">
                Created a temporary agent from your avatar ID automatically.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
