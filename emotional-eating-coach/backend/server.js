const express = require('express');
const cors = require('cors');
require('dotenv').config();
const EmotionalEatingAgent = require('./EmotionalEatingAgent'); // Create this file with the agent code

const app = express();
app.use(cors());
app.use(express.json());

// Initialize AI Agent
const agent = new EmotionalEatingAgent(process.env.OPENAI_API_KEY);

// Enhanced storage (in production, use a real database)
let conversations = {};
let moodEntries = [];
let userSessions = {};

// Enhanced chat endpoint with agent capabilities
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId = 'demo' } = req.body;
    
    // Initialize user session
    if (!userSessions[userId]) {
      userSessions[userId] = {
        startTime: new Date().toISOString(),
        messageCount: 0,
        lastActiveTime: new Date().toISOString()
      };
    }

    // Update session
    userSessions[userId].messageCount++;
    userSessions[userId].lastActiveTime = new Date().toISOString();
    
    // Initialize conversation history
    if (!conversations[userId]) {
      conversations[userId] = [];
    }
    
    // Get user's mood entries for context
    const userMoodEntries = moodEntries.filter(entry => entry.userId === userId);
    
    // Build context for agent
    const context = {
      conversations: conversations[userId],
      moodEntries: userMoodEntries,
      currentState: {
        sessionLength: userSessions[userId].messageCount,
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay()
      }
    };

    // Get agent response
    const agentResponse = await agent.generateAgentResponse(userId, message, context);
    
    // Save conversation
    conversations[userId].push(
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { 
        role: 'assistant', 
        content: agentResponse.response,
        emotion: agentResponse.emotion,
        confidence: agentResponse.confidence,
        agentAction: agentResponse.agentAction,
        timestamp: new Date().toISOString()
      }
    );

    // Keep conversation history manageable
    if (conversations[userId].length > 100) {
      conversations[userId] = conversations[userId].slice(-80);
    }

    res.json({
      response: agentResponse.response,
      emotion: agentResponse.emotion,
      confidence: agentResponse.confidence,
      intervention: agentResponse.intervention,
      agentAction: agentResponse.agentAction,
      insights: agentResponse.insights,
      recommendations: agentResponse.recommendations,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'I\'m having trouble right now. Take a deep breath - you\'ve got this. Try again in a moment.',
      fallbackSuggestion: 'Try the 4-7-8 breathing technique: breathe in for 4, hold for 7, exhale for 8.'
    });
  }
});

// Enhanced mood logging with validation
app.post('/api/mood', (req, res) => {
  try {
    const { emotion, intensity, trigger, context, userId = 'demo' } = req.body;
    
    // Validation
    if (!emotion || !intensity || !trigger) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (intensity < 1 || intensity > 10) {
      return res.status(400).json({ error: 'Intensity must be between 1 and 10' });
    }

    const entry = {
      id: Date.now() + Math.random(),
      userId,
      emotion: emotion.toLowerCase(),
      intensity: parseInt(intensity),
      trigger,
      context: context || '',
      timestamp: new Date().toISOString(),
      hour: new Date().getHours(),
      dayOfWeek: new Date().getDay()
    };
    
    moodEntries.push(entry);
    
    // Trigger agent analysis for patterns
    setTimeout(async () => {
      try {
        const userMoodEntries = moodEntries.filter(e => e.userId === userId);
        if (userMoodEntries.length >= 3) {
          const patterns = agent.analyzeMoodPatterns(userMoodEntries);
          console.log(`Updated patterns for ${userId}:`, patterns);
        }
      } catch (error) {
        console.error('Pattern analysis error:', error);
      }
    }, 1000);
    
    res.json({ success: true, entry });
  } catch (error) {
    console.error('Mood logging error:', error);
    res.status(500).json({ error: 'Failed to save mood entry' });
  }
});

// Enhanced analytics with deeper insights
app.get('/api/analytics/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userEntries = moodEntries.filter(entry => entry.userId === userId);
    const userConversations = conversations[userId] || [];
    
    if (userEntries.length === 0) {
      return res.json({ message: 'No data yet - start logging moods to see patterns!' });
    }

    // Basic analytics
    const emotions = userEntries.map(e => e.emotion);
    const triggers = userEntries.map(e => e.trigger);
    const intensities = userEntries.map(e => e.intensity);
    
    // Advanced pattern analysis
    const patterns = agent.analyzeMoodPatterns(userEntries);
    
    // Risk analysis
    const highIntensityEntries = userEntries.filter(e => e.intensity >= 7);
    const riskFactors = {
      highIntensityFrequency: (highIntensityEntries.length / userEntries.length) * 100,
      mostRiskyTrigger: getMostFrequent(highIntensityEntries.map(e => e.trigger)),
      averageHighIntensity: highIntensityEntries.reduce((sum, e) => sum + e.intensity, 0) / highIntensityEntries.length || 0
    };

    // Conversation analysis
    const conversationInsights = {
      totalMessages: userConversations.length,
      averageSessionLength: userSessions[userId]?.messageCount || 0,
      mostDiscussedEmotions: getMostFrequent(
        userConversations
          .filter(msg => msg.role === 'assistant' && msg.emotion)
          .map(msg => msg.emotion)
      )
    };

    // Progress tracking
    const recentEntries = userEntries.slice(-7); // Last 7 entries
    const olderEntries = userEntries.slice(0, -7);
    const progressIndicators = {
      recentAverageIntensity: recentEntries.reduce((sum, e) => sum + e.intensity, 0) / recentEntries.length || 0,
      previousAverageIntensity: olderEntries.reduce((sum, e) => sum + e.intensity, 0) / olderEntries.length || 0,
      improvementTrend: recentEntries.length > 0 && olderEntries.length > 0
    };

    res.json({
      basic: {
        totalEntries: userEntries.length,
        mostCommonEmotion: getMostFrequent(emotions),
        mostCommonTrigger: getMostFrequent(triggers),
        averageIntensity: (intensities.reduce((a, b) => a + b, 0) / intensities.length).toFixed(1)
      },
      patterns,
      riskFactors,
      conversationInsights,
      progressIndicators,
      recommendations: agent.generateRecommendations({ patterns })
    });
    
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

// Proactive check-in endpoint
app.post('/api/check-in/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userMoodEntries = moodEntries.filter(entry => entry.userId === userId);
    
    if (userMoodEntries.length === 0) {
      return res.json({
        message: "How are you doing today?",
        type: 'general_checkin'
      });
    }

    const patterns = agent.analyzeMoodPatterns(userMoodEntries);
    const currentHour = new Date().getHours();
    
    // Check if it's a high-risk time
    const isRiskTime = patterns.riskTimes && patterns.riskTimes.some(time => 
      Math.abs(parseInt(time.split(':')[0]) - currentHour) <= 1
    );

    if (isRiskTime) {
      return res.json({
        message: `I noticed this is usually a challenging time for you (around ${currentHour}:00). How are you feeling right now?`,
        type: 'risk_time_checkin',
        suggestion: 'Consider having a plan ready for this time - maybe a breathing exercise or calling a friend?'
      });
    }

    // Check for pattern-based check-ins
    const lastEntry = userMoodEntries[userMoodEntries.length - 1];
    const timeSinceLastEntry = Date.now() - new Date(lastEntry.timestamp).getTime();
    const hoursSinceLastEntry = timeSinceLastEntry / (1000 * 60 * 60);

    if (hoursSinceLastEntry > 24) {
      return res.json({
        message: "I haven't heard from you in a while. How has your emotional eating been lately?",
        type: 'followup_checkin'
      });
    }

    res.json({
      message: "How are you feeling today?",
      type: 'general_checkin'
    });

  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Failed to generate check-in' });
  }
});

// Crisis detection endpoint
app.post('/api/crisis-check', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    const crisisKeywords = [
      'self-harm', 'hurt myself', 'end it all', 'not worth living',
      'kill myself', 'suicide', 'can\'t go on', 'want to die'
    ];
    
    const restrictionKeywords = [
      'haven\'t eaten in days', 'not eating anything', 'starving myself',
      'punishing myself', 'don\'t deserve food'
    ];

    const lowerMessage = message.toLowerCase();
    
    const hasCrisisKeywords = crisisKeywords.some(keyword => lowerMessage.includes(keyword));
    const hasRestrictionKeywords = restrictionKeywords.some(keyword => lowerMessage.includes(keyword));
    
    if (hasCrisisKeywords || hasRestrictionKeywords) {
      return res.json({
        requiresEscalation: true,
        type: hasCrisisKeywords ? 'crisis' : 'severe_restriction',
        resources: {
          crisis: '988 Suicide & Crisis Lifeline: 988 or chat at 988lifeline.org',
          eating: 'NEDA Helpline: 1-800-931-2237 or chat at nationaleatingdisorders.org'
        },
        message: 'I\'m concerned about what you\'re sharing. Please reach out to a professional who can provide the support you deserve.'
      });
    }

    res.json({ requiresEscalation: false });
    
  } catch (error) {
    console.error('Crisis check error:', error);
    res.status(500).json({ error: 'Failed to perform crisis check' });
  }
});

// Helper functions
function getMostFrequent(arr) {
  if (arr.length === 0) return 'none';
  const counts = {};
  arr.forEach(item => counts[item] = (counts[item] || 0) + 1);
  return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
}

// Demo data endpoint
app.get('/api/demo-init', (req, res) => {
  const demoData = [
    { emotion: 'stressed', intensity: 8, trigger: 'work deadline', userId: 'demo', timestamp: new Date(Date.now() - 86400000).toISOString() },
    { emotion: 'bored', intensity: 6, trigger: 'weekend afternoon', userId: 'demo', timestamp: new Date(Date.now() - 172800000).toISOString() },
    { emotion: 'anxious', intensity: 9, trigger: 'social event', userId: 'demo', timestamp: new Date(Date.now() - 259200000).toISOString() },
  ];
  
  moodEntries.push(...demoData.map(entry => ({
    ...entry,
    id: Date.now() + Math.random(),
    hour: new Date(entry.timestamp).getHours(),
    dayOfWeek: new Date(entry.timestamp).getDay()
  })));
  
  res.json({ message: 'Demo data loaded!' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🤖 Enhanced Emotional Eating Agent running on port ${PORT}`);
});