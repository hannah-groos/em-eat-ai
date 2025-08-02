import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I\'m here to help you work through emotional eating patterns. How are you feeling right now?',
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMoodLogger, setShowMoodLogger] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    loadAnalytics();
  }, [messages]);

  const loadAnalytics = async () => {
    try {
      const response = await axios.get(`${API_BASE}/analytics/demo`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
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
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/chat`, {
        message: input.trim(),
        userId: 'demo'
      });

      const aiMessage = {
        role: 'assistant',
        content: response.data.response,
        emotion: response.data.emotion,
        intervention: response.data.intervention,
        timestamp: response.data.timestamp
      };

      setMessages(prev => [...prev, aiMessage]);
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

  return (
    <div className="app">
      <header className="app-header">
        <h1>🧠💙 Emotional Eating Coach</h1>
        <button 
          className="mood-btn"
          onClick={() => setShowMoodLogger(!showMoodLogger)}
        >
          {showMoodLogger ? 'Hide' : 'Log Mood'}
        </button>
      </header>

      <div className="main-content">
        <div className="chat-container">
          <div className="messages">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.role}`}>
                <div className="message-content">
                  {message.content}
                </div>
                {message.emotion && message.emotion !== 'neutral' && (
                  <div className="emotion-tag">
                    Detected: {message.emotion}
                  </div>
                )}
                {message.intervention && (
                  <div className="intervention">
                    <strong>💡 Try this:</strong> {message.intervention}
                  </div>
                )}
                <div className="timestamp">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
            {loading && (
              <div className="message assistant">
                <div className="typing">Thinking...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-area">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Share what you're feeling..."
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

        {showMoodLogger && (
          <MoodLogger 
            onClose={() => setShowMoodLogger(false)}
            onSubmit={loadAnalytics}
          />
        )}

        {analytics && analytics.totalEntries > 0 && (
          <div className="analytics">
            <h3>Your Patterns</h3>
            <div className="stats">
              <div>📊 {analytics.totalEntries} mood entries</div>
              <div>😊 Most common: {analytics.mostCommonEmotion}</div>
              <div>🎯 Top trigger: {analytics.mostCommonTrigger}</div>
              <div>📈 Avg intensity: {analytics.averageIntensity.toFixed(1)}/10</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MoodLogger({ onClose, onSubmit }) {
  const [emotion, setEmotion] = useState('');
  const [intensity, setIntensity] = useState(5);
  const [trigger, setTrigger] = useState('');

  const emotions = ['happy', 'sad', 'angry', 'anxious', 'bored', 'stressed', 'lonely'];
  const triggers = ['work stress', 'relationship', 'boredom', 'social media', 'news', 'health', 'finances', 'other'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emotion || !trigger) return;

    try {
      await axios.post(`${API_BASE}/mood`, {
        emotion,
        intensity: parseInt(intensity),
        trigger,
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

        <div className="form-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={!emotion || !trigger}>Save</button>
        </div>
      </form>
    </div>
  );
}

export default App;