import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I\'m your AI emotional eating coach. I learn from our conversations to help you better over time. How are you feeling right now?',
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMoodLogger, setShowMoodLogger] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [insights, setInsights] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [checkInMessage, setCheckInMessage] = useState(null);
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    loadAnalytics();
    performCheckIn();
  }, [messages]);

  // Auto check-in every 30 minutes
  useEffect(() => {
    const interval = setInterval(performCheckIn, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadAnalytics = async () => {
    try {
      const response = await axios.get(`${API_BASE}/analytics/demo`);
      setAnalytics(response.data);
      if (response.data.recommendations) {
        setRecommendations(response.data.recommendations);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const performCheckIn = async () => {
    try {
      const response = await axios.post(`${API_BASE}/check-in/demo`);
      if (response.data.type !== 'general_checkin') {
        setCheckInMessage(response.data);
      }
    } catch (error) {
      console.error('Check-in failed:', error);
    }
  };

  const checkForCrisis = async (message) => {
    try {
      const response = await axios.post(`${API_BASE}/crisis-check`, {
        message,
        userId: 'demo'
      });
      
      if (response.data.requiresEscalation) {
        setShowCrisisAlert(response.data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Crisis check failed:', error);
      return false;
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = input.trim();
    setInput('');
    setLoading(true);

    // Check for crisis situations first
    const isCrisis = await checkForCrisis(messageText);
    if (isCrisis) {
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_BASE}/chat`, {
        message: messageText,
        userId: 'demo'
      });

      const aiMessage = {
        role: 'assistant',
        content: response.data.response,
        emotion: response.data.emotion,
        confidence: response.data.confidence,
        intervention: response.data.intervention,
        agentAction: response.data.agentAction,
        insights: response.data.insights || [],
        timestamp: response.data.timestamp
      };

      setMessages(prev => [...prev, aiMessage]);
      
      if (response.data.insights) {
        setInsights(prev => [...prev, ...response.data.insights]);
      }

    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'m having trouble right now. Take a deep breath - you\'ve got this. Try again in a moment.',
        timestamp: new Date().toISOString()
      }]);
    }

    setLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const dismissCheckIn = () => {
    setCheckInMessage(null);
  };

  const respondToCheckIn = () => {
    setInput(checkInMessage.message);
    setCheckInMessage(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖💙 AI Emotional Eating Coach</h1>
        <div className="header-actions">
          <button 
            className="mood-btn"
            onClick={() => setShowMoodLogger(!showMoodLogger)}
          >
            {showMoodLogger ? 'Hide' : 'Log Mood'}
          </button>
          <button className="insights-btn" title="Active Insights">
            💡 {insights.length}
          </button>
        </div>
      </header>

      {/* Crisis Alert */}
      {showCrisisAlert && (
        <CrisisAlert 
          alert={showCrisisAlert} 
          onClose={() => setShowCrisisAlert(false)} 
        />
      )}

      {/* Check-in Notification */}
      {checkInMessage && (
        <CheckInNotification 
          checkIn={checkInMessage}
          onDismiss={dismissCheckIn}
          onRespond={respondToCheckIn}
        />
      )}

      <div className="main-content">
        <div className="chat-container">
          <div className="messages">
            {messages.map((message, index) => (
              <MessageBubble key={index} message={message} />
            ))}
            {loading && (
              <div className="message assistant">
                <div className="typing">
                  <span></span><span></span><span></span>
                  Analyzing and thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-area">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Share what you're feeling... I'm learning to help you better."
              rows={2}
            />
            <button 
              onClick={sendMessage} 
              disabled={loading || !input.trim()}
              className="send-btn"
            >
              Send
            </button>
          </div>
        </div>

        <div className="sidebar">
          {showMoodLogger && (
            <MoodLogger 
              onClose={() => setShowMoodLogger(false)}
              onSubmit={loadAnalytics}
            />
          )}

          {analytics && (
            <AnalyticsDashboard analytics={analytics} />
          )}

          {insights.length > 0 && (
            <InsightsPanel 
              insights={insights} 
              onClear={() => setInsights([])} 
            />
          )}

          {recommendations.length > 0 && (
            <RecommendationsPanel recommendations={recommendations} />
          )}
        </div>
      </div>
    </div>
  );
}

// Enhanced Message Bubble Component
function MessageBubble({ message }) {
  const getAgentActionIcon = (action) => {
    if (!action) return '';
    switch (action.type) {
      case 'emergency_intervention': return '🚨';
      case 'pattern_based_support': return '🎯';
      case 'preventive_check_in': return '⏰';
      default: return '💬';
    }
  };

  const getEmotionColor = (emotion) => {
    const colors = {
      'stressed': '#ff6b6b',
      'sad': '#4ecdc4',
      'angry': '#ff8e53',
      'anxious': '#45b7d1',
      'bored': '#96ceb4',
      'happy': '#feca57'
    };
    return colors[emotion] || '#95a5a6';
  };

  return (
    <div className={`message ${message.role}`}>
      <div className="message-content">
        {message.content}
      </div>

      {/* Agent Action Indicator */}
      {message.agentAction && (
        <div className="agent-action">
          {getAgentActionIcon(message.agentAction)} 
          {message.agentAction.focus?.replace('_', ' ')}
        </div>
      )}

      {/* Emotion Detection */}
      {message.emotion && message.emotion !== 'neutral' && (
        <div 
          className="emotion-tag"
          style={{ borderLeft: `4px solid ${getEmotionColor(message.emotion)}` }}
        >
          Detected: {message.emotion}
          {message.confidence && (
            <span className="confidence">
              ({Math.round(message.confidence * 100)}% confident)
            </span>
          )}
        </div>
      )}

      {/* Intervention Suggestion */}
      {message.intervention && (
        <div className="intervention">
          <strong>💡 Try this:</strong> {message.intervention}
          <button className="intervention-btn" onClick={() => {}}>
            Mark as Helpful
          </button>
        </div>
      )}

      {/* Real-time Insights */}
      {message.insights && message.insights.length > 0 && (
        <div className="message-insights">
          {message.insights.map((insight, idx) => (
            <div key={idx} className="insight">
              🔍 {insight}
            </div>
          ))}
        </div>
      )}

      <div className="timestamp">
        {new Date(message.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

// Crisis Alert Component
function CrisisAlert({ alert, onClose }) {
  return (
    <div className="crisis-overlay">
      <div className="crisis-alert">
        <h3>🆘 We're Concerned About You</h3>
        <p>{alert.message}</p>
        <div className="crisis-resources">
          {alert.resources.crisis && (
            <div className="resource">
              <strong>Crisis Support:</strong> {alert.resources.crisis}
            </div>
          )}
          {alert.resources.eating && (
            <div className="resource">
              <strong>Eating Disorder Support:</strong> {alert.resources.eating}
            </div>
          )}
        </div>
        <button onClick={onClose} className="crisis-close">
          I understand
        </button>
      </div>
    </div>
  );
}

// Check-in Notification Component
function CheckInNotification({ checkIn, onDismiss, onRespond }) {
  return (
    <div className="checkin-notification">
      <div className="checkin-content">
        <span className="checkin-icon">
          {checkIn.type === 'risk_time_checkin' ? '⏰' : '💙'}
        </span>
        <span className="checkin-message">{checkIn.message}</span>
        <div className="checkin-actions">
          <button onClick={onRespond} className="checkin-respond">
            Respond
          </button>
          <button onClick={onDismiss} className="checkin-dismiss">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// Enhanced Analytics Dashboard
function AnalyticsDashboard({ analytics }) {
  if (!analytics.basic) return null;

  const getProgressIndicator = () => {
    if (!analytics.progressIndicators?.improvementTrend) return null;
    
    const recent = analytics.progressIndicators.recentAverageIntensity;
    const previous = analytics.progressIndicators.previousAverageIntensity;
    const improvement = previous - recent;
    
    if (improvement > 0.5) return { text: 'Improving! 📈', color: '#27ae60' };
    if (improvement < -0.5) return { text: 'Needs attention 📉', color: '#e74c3c' };
    return { text: 'Stable 📊', color: '#f39c12' };
  };

  const progress = getProgressIndicator();

  return (
    <div className="analytics">
      <h3>📊 Your Patterns</h3>
      
      <div className="stats">
        <div className="stat-item">
          📈 {analytics.basic.totalEntries} mood entries
        </div>
        
        <div className="stat-item">
          😊 Most common: {analytics.basic.mostCommonEmotion}
        </div>
        
        <div className="stat-item">
          🎯 Top trigger: {analytics.basic.mostCommonTrigger}
        </div>
        
        <div className="stat-item">
          📊 Avg intensity: {analytics.basic.averageIntensity}/10
        </div>

        {progress && (
          <div className="stat-item" style={{ color: progress.color }}>
            {progress.text}
          </div>
        )}
      </div>

      {/* Risk Analysis */}
      {analytics.riskFactors && (
        <div className="risk-analysis">
          <h4>⚠️ Risk Factors</h4>
          <div className="risk-item">
            High intensity episodes: {Math.round(analytics.riskFactors.highIntensityFrequency)}%
          </div>
          {analytics.riskFactors.mostRiskyTrigger && (
            <div className="risk-item">
              Highest risk trigger: {analytics.riskFactors.mostRiskyTrigger}
            </div>
          )}
        </div>
      )}

      {/* Pattern Insights */}
      {analytics.patterns?.riskTimes && (
        <div className="patterns">
          <h4>🕐 Risk Times</h4>
          <div className="pattern-times">
            {analytics.patterns.riskTimes.map((time, idx) => (
              <span key={idx} className="risk-time">{time}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Insights Panel Component
function InsightsPanel({ insights, onClear }) {
  return (
    <div className="insights-panel">
      <div className="insights-header">
        <h3>💡 Live Insights</h3>
        <button onClick={onClear} className="clear-insights">Clear</button>
      </div>
      <div className="insights-list">
        {insights.slice(-5).map((insight, idx) => (
          <div key={idx} className="insight-item">
            {insight}
          </div>
        ))}
      </div>
    </div>
  );
}

// Recommendations Panel Component
function RecommendationsPanel({ recommendations }) {
  return (
    <div className="recommendations-panel">
      <h3>🎯 Recommendations</h3>
      <div className="recommendations-list">
        {recommendations.map((rec, idx) => (
          <div key={idx} className="recommendation-item">
            💡 {rec}
          </div>
        ))}
      </div>
    </div>
  );
}

// Enhanced Mood Logger
function MoodLogger({ onClose, onSubmit }) {
  const [emotion, setEmotion] = useState('');
  const [intensity, setIntensity] = useState(5);
  const [trigger, setTrigger] = useState('');
  const [context, setContext] = useState('');

  const emotions = ['happy', 'sad', 'angry', 'anxious', 'bored', 'stressed', 'lonely', 'excited', 'frustrated'];
  const triggers = ['work stress', 'relationship', 'boredom', 'social media', 'news', 'health', 'finances', 'social pressure', 'other'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emotion || !trigger) return;

    try {
      await axios.post(`${API_BASE}/mood`, {
        emotion,
        intensity: parseInt(intensity),
        trigger,
        context,
        userId: 'demo'
      });
      
      onSubmit && onSubmit();
      onClose();
    } catch (error) {
      alert('Failed to save mood entry');
    }
  };

  return (
    <div className="mood-logger">
      <h3>Log Your Mood</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>How are you feeling?</label>
          <select value={emotion} onChange={(e) => setEmotion(e.target.value)}>
            <option value="">Select emotion...</option>
            {emotions.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Intensity (1-10): {intensity}</label>
          <input
            type="range"
            min="1"
            max="10"
            value={intensity}
            onChange={(e) => setIntensity(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>What triggered this?</label>
          <select value={trigger} onChange={(e) => setTrigger(e.target.value)}>
            <option value="">Select trigger...</option>
            {triggers.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Additional context (optional)</label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Any additional details..."
            rows={2}
          />
        </div>

        <div className="form-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={!emotion || !trigger}>Save</button>
        </div>
      </form>
    </div>
  );
}

export default App;