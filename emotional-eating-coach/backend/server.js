const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// In-memory storage (replace with DB later)
let conversations = {};
let moodEntries = [];

const SYSTEM_PROMPT = `You are an empathetic emotional eating coach. Your role is to:
1. Help users identify emotional triggers for eating
2. Provide alternative coping strategies in 2-3 sentences
3. Offer non-judgmental support
4. Suggest simple 5-minute activities as alternatives

Keep responses short, warm, and actionable. Always end with a specific suggestion.
Avoid diet culture language. Focus on emotions, not weight.`;

// Simple emotion detection
function detectEmotion(text) {
  const emotions = {
    'stress': ['stressed', 'overwhelmed', 'pressure', 'deadline', 'anxious'],
    'sad': ['sad', 'depressed', 'down', 'lonely', 'empty'],
    'bored': ['bored', 'nothing to do', 'mindless', 'restless'],
    'angry': ['angry', 'frustrated', 'mad', 'annoyed']
  };
  
  const lowerText = text.toLowerCase();
  for (const [emotion, keywords] of Object.entries(emotions)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return emotion;
    }
  }
  return 'neutral';
}

// Simple interventions
const interventions = {
  'stress': [
    'Try the 4-7-8 breathing: breathe in for 4, hold for 7, exhale for 8',
    'Take 5 deep breaths and name 5 things you can see around you',
    'Do 10 jumping jacks or stretch your arms above your head'
  ],
  'sad': [
    'Call or text someone who cares about you',
    'Write down 3 things you\'re grateful for today',
    'Listen to your favorite uplifting song'
  ],
  'bored': [
    'Try a 5-minute creative activity: draw, write, or organize something',
    'Go for a short walk, even if it\'s just around your room',
    'Do a quick online search for something you\'ve always wondered about'
  ],
  'angry': [
    'Write your feelings on paper, then crumple it up',
    'Do some physical movement: push-ups, dancing, or quick walk',
    'Practice the STOP technique: Stop, Take a breath, Observe, Proceed mindfully'
  ]
};

app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId = 'demo' } = req.body;
    
    // Initialize conversation history
    if (!conversations[userId]) {
      conversations[userId] = [];
    }
    
    // Detect emotion and get intervention
    const emotion = detectEmotion(message);
    const intervention = interventions[emotion] ? 
      interventions[emotion][Math.floor(Math.random() * interventions[emotion].length)] : null;
    
    // Build conversation context
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversations[userId].slice(-6), // Keep last 6 messages for context
      { role: 'user', content: message }
    ];
    
    // Get AI response
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 150,
      temperature: 0.7
    });
    
    const aiResponse = completion.choices[0].message.content;
    
    // Save conversation
    conversations[userId].push(
      { role: 'user', content: message },
      { role: 'assistant', content: aiResponse }
    );
    
    res.json({
      response: aiResponse,
      emotion: emotion,
      intervention: intervention,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Something went wrong. Try: "Take a deep breath and try again in a moment."' 
    });
  }
});

app.post('/api/mood', (req, res) => {
  const { emotion, intensity, trigger, userId = 'demo' } = req.body;
  
  const entry = {
    id: Date.now(),
    userId,
    emotion,
    intensity,
    trigger,
    timestamp: new Date().toISOString()
  };
  
  moodEntries.push(entry);
  res.json({ success: true, entry });
});

app.get('/api/mood/:userId', (req, res) => {
  const { userId } = req.params;
  const userEntries = moodEntries.filter(entry => entry.userId === userId);
  res.json(userEntries);
});

// Simple analytics endpoint
app.get('/api/analytics/:userId', (req, res) => {
  const { userId } = req.params;
  const userEntries = moodEntries.filter(entry => entry.userId === userId);
  
  const analytics = {
    totalEntries: userEntries.length,
    mostCommonEmotion: getMostCommon(userEntries.map(e => e.emotion)),
    mostCommonTrigger: getMostCommon(userEntries.map(e => e.trigger)),
    averageIntensity: userEntries.reduce((sum, e) => sum + e.intensity, 0) / userEntries.length || 0
  };
  
  res.json(analytics);
});

function getMostCommon(arr) {
  const counts = {};
  arr.forEach(item => counts[item] = (counts[item] || 0) + 1);
  return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, '');
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;