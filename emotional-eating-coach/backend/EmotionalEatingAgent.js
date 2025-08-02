const OpenAI = require('openai');

class EmotionalEatingAgent {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    this.userProfiles = new Map(); // Store user profiles and patterns
    this.interventionHistory = new Map(); // Track intervention effectiveness
  }

  // Enhanced system prompt with agent capabilities
  getSystemPrompt(userProfile = {}) {
    const { patterns = {}, preferences = {}, goals = [] } = userProfile;
    
    return `You are an advanced emotional eating coach AI agent with the following capabilities:

CORE IDENTITY:
- Empathetic, non-judgmental emotional eating specialist
- Focus on emotional regulation, not weight loss or diet culture
- Use evidence-based CBT and mindfulness techniques

AGENT CAPABILITIES:
1. ANALYZE patterns in user's emotional eating triggers
2. REMEMBER previous conversations and progress
3. ADAPT interventions based on what worked before
4. PROACTIVELY check in on user's emotional state
5. ESCALATE to professional help if needed

USER CONTEXT:
${patterns.mostCommonTrigger ? `- Primary trigger: ${patterns.mostCommonTrigger}` : ''}
${patterns.riskTimes ? `- High-risk times: ${patterns.riskTimes.join(', ')}` : ''}
${preferences.preferredInterventions ? `- Preferred interventions: ${preferences.preferredInterventions.join(', ')}` : ''}
${goals.length ? `- Current goals: ${goals.join(', ')}` : ''}

RESPONSE GUIDELINES:
- Keep responses 2-4 sentences max unless user asks for details
- Always offer a specific, actionable suggestion
- Reference user's past patterns when relevant
- Ask follow-up questions to understand context
- Celebrate small wins and progress

INTERVENTION STRATEGIES:
1. Breathing exercises (4-7-8, box breathing)
2. Grounding techniques (5-4-3-2-1 sensory)
3. Physical movement (walking, stretching)
4. Emotional expression (journaling, calling friend)
5. Mindful alternatives (tea, music, art)
6. Cognitive reframing

ESCALATION TRIGGERS:
- Mentions of self-harm, extreme restriction, or purging
- Severe depression indicators
- Substance abuse mentions
- Request for medical advice

Remember: You're an AI agent that learns and adapts to help each user most effectively.`;
  }

  // Build comprehensive user profile
  async buildUserProfile(userId, conversations, moodEntries) {
    const profile = this.userProfiles.get(userId) || {
      patterns: {},
      preferences: {},
      goals: [],
      riskFactors: [],
      successfulInterventions: [],
      conversationHistory: []
    };

    // Analyze mood patterns
    if (moodEntries.length > 0) {
      profile.patterns = this.analyzeMoodPatterns(moodEntries);
    }

    // Analyze conversation patterns
    if (conversations.length > 5) {
      profile.preferences = await this.analyzeConversationPatterns(conversations);
    }

    this.userProfiles.set(userId, profile);
    return profile;
  }

  // Analyze mood entry patterns
  analyzeMoodPatterns(moodEntries) {
    const emotions = moodEntries.map(e => e.emotion);
    const triggers = moodEntries.map(e => e.trigger);
    const intensities = moodEntries.map(e => e.intensity);
    const times = moodEntries.map(e => new Date(e.timestamp));

    // Find most common triggers and emotions
    const triggerCounts = this.countOccurrences(triggers);
    const emotionCounts = this.countOccurrences(emotions);

    // Analyze time patterns
    const hourCounts = this.countOccurrences(times.map(t => t.getHours()));
    const dayOfWeekCounts = this.countOccurrences(times.map(t => t.getDay()));

    // Calculate risk times (high intensity + frequent)
    const riskHours = Object.entries(hourCounts)
      .filter(([hour, count]) => count >= 2)
      .map(([hour]) => parseInt(hour))
      .sort((a, b) => hourCounts[b] - hourCounts[a])
      .slice(0, 3);

    return {
      mostCommonTrigger: Object.keys(triggerCounts)[0],
      mostCommonEmotion: Object.keys(emotionCounts)[0],
      averageIntensity: intensities.reduce((a, b) => a + b, 0) / intensities.length,
      riskTimes: riskHours.map(h => `${h}:00`),
      totalEntries: moodEntries.length,
      triggerFrequency: triggerCounts,
      emotionFrequency: emotionCounts
    };
  }

  // Analyze what interventions and conversation styles work
  async analyzeConversationPatterns(conversations) {
    const analysisPrompt = `Analyze these conversation patterns and identify:
1. What types of responses the user engages with most
2. What intervention suggestions they seem to follow
3. What communication style works best

Conversations: ${JSON.stringify(conversations.slice(-10))}

Return JSON with: { preferredStyle, effectiveInterventions, engagementPatterns }`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.3
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      return { preferredStyle: 'supportive', effectiveInterventions: [], engagementPatterns: {} };
    }
  }

  // Enhanced response generation with agent capabilities
  async generateAgentResponse(userId, message, context = {}) {
    const { conversations = [], moodEntries = [], currentState = {} } = context;
    
    // Build/update user profile
    const userProfile = await this.buildUserProfile(userId, conversations, moodEntries);
    
    // Detect current emotional state and context
    const emotionalAnalysis = await this.analyzeEmotionalState(message, userProfile);
    
    // Determine agent action
    const agentAction = this.determineAgentAction(emotionalAnalysis, userProfile, currentState);
    
    // Generate contextual response
    const systemPrompt = this.getSystemPrompt(userProfile);
    const conversationContext = this.buildConversationContext(conversations, emotionalAnalysis, agentAction);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationContext,
      { role: 'user', content: message }
    ];

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: messages,
      temperature: 0.7,
      max_tokens: 200
    });

    const aiResponse = response.choices[0].message.content;
    
    // Generate personalized intervention
    const intervention = this.generatePersonalizedIntervention(
      emotionalAnalysis, 
      userProfile, 
      agentAction
    );

    // Update user profile with this interaction
    this.updateUserProfile(userId, { message, response: aiResponse, emotionalAnalysis, intervention });

    return {
      response: aiResponse,
      emotion: emotionalAnalysis.primaryEmotion,
      confidence: emotionalAnalysis.confidence,
      intervention: intervention,
      agentAction: agentAction,
      insights: this.generateInsights(userProfile, emotionalAnalysis),
      recommendations: this.generateRecommendations(userProfile)
    };
  }

  // Advanced emotional state analysis
  async analyzeEmotionalState(message, userProfile) {
    const patterns = userProfile.patterns || {};
    
    // Enhanced emotion detection with context
    const emotionPrompt = `Analyze this message for emotional eating context:
"${message}"

User's typical patterns: ${JSON.stringify(patterns)}

Return JSON with:
{
  "primaryEmotion": "emotion",
  "intensity": 1-10,
  "triggers": ["trigger1", "trigger2"],
  "eatingUrge": 1-10,
  "riskLevel": "low|medium|high",
  "context": "brief description"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: emotionPrompt }],
        temperature: 0.3
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      // Fallback to simple detection
      return {
        primaryEmotion: this.detectEmotionFallback(message),
        intensity: 5,
        triggers: [],
        eatingUrge: 3,
        riskLevel: 'medium',
        context: 'Unable to analyze deeply'
      };
    }
  }

  // Determine what action the agent should take
  determineAgentAction(emotionalAnalysis, userProfile, currentState) {
    const { riskLevel, eatingUrge, primaryEmotion } = emotionalAnalysis;
    const { patterns = {} } = userProfile;

    // High-risk situations need immediate intervention
    if (riskLevel === 'high' || eatingUrge >= 8) {
      return {
        type: 'emergency_intervention',
        priority: 'high',
        focus: 'immediate_coping'
      };
    }

    // Pattern-based actions
    if (patterns.mostCommonTrigger && emotionalAnalysis.triggers.includes(patterns.mostCommonTrigger)) {
      return {
        type: 'pattern_based_support',
        priority: 'medium',
        focus: 'known_trigger'
      };
    }

    // Check if it's a high-risk time
    const currentHour = new Date().getHours();
    if (patterns.riskTimes && patterns.riskTimes.some(time => 
      Math.abs(parseInt(time.split(':')[0]) - currentHour) <= 1)) {
      return {
        type: 'preventive_check_in',
        priority: 'medium',
        focus: 'risk_time'
      };
    }

    return {
      type: 'supportive_conversation',
      priority: 'low',
      focus: 'general_support'
    };
  }

  // Generate personalized interventions based on what works for this user
  generatePersonalizedIntervention(emotionalAnalysis, userProfile, agentAction) {
    const { primaryEmotion, intensity, riskLevel } = emotionalAnalysis;
    const { successfulInterventions = [], preferences = {} } = userProfile;

    const interventionBank = {
      high_intensity: [
        "STOP technique: Stop what you're doing, Take 3 deep breaths, Observe your feelings, Proceed with intention",
        "5-4-3-2-1 grounding: Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste",
        "Call someone who supports you right now - even a 2-minute check-in can help"
      ],
      stress: [
        "Try progressive muscle relaxation: tense and release each muscle group for 5 seconds",
        "Write your thoughts on paper for 3 minutes - no editing, just dump everything out",
        "Do 10 jumping jacks or push-ups to release physical tension"
      ],
      sadness: [
        "Practice self-compassion: What would you say to a friend feeling this way?",
        "Listen to one song that usually lifts your mood",
        "Write down 3 things you're grateful for today, however small"
      ],
      boredom: [
        "Set a 10-minute timer for a creative activity: draw, write, organize something",
        "Learn something new: look up a random topic you've always wondered about",
        "Text someone you haven't talked to in a while"
      ],
      anger: [
        "Try the RAIN technique: Recognize, Accept, Investigate with kindness, Natural awareness",
        "Do something physical: dance to one song, do stretches, or clean vigorously",
        "Write an angry letter you'll never send, then tear it up"
      ]
    };

    // Prioritize interventions that worked before
    if (successfulInterventions.length > 0) {
      const relevant = successfulInterventions.filter(i => 
        i.emotion === primaryEmotion || i.riskLevel === riskLevel
      );
      if (relevant.length > 0) {
        return relevant[0].intervention + " (This worked for you before!)";
      }
    }

    // High-intensity situations get emergency interventions
    if (intensity >= 8 || riskLevel === 'high') {
      return interventionBank.high_intensity[Math.floor(Math.random() * interventionBank.high_intensity.length)];
    }

    // Emotion-specific interventions
    const emotionInterventions = interventionBank[primaryEmotion] || interventionBank.stress;
    return emotionInterventions[Math.floor(Math.random() * emotionInterventions.length)];
  }

  // Generate insights about patterns
  generateInsights(userProfile, currentAnalysis) {
    const { patterns = {} } = userProfile;
    const insights = [];

    if (patterns.mostCommonTrigger && currentAnalysis.triggers.includes(patterns.mostCommonTrigger)) {
      insights.push(`This is your most common trigger - we've worked on this ${patterns.triggerFrequency[patterns.mostCommonTrigger]} times`);
    }

    const currentHour = new Date().getHours();
    if (patterns.riskTimes && patterns.riskTimes.some(time => 
      Math.abs(parseInt(time.split(':')[0]) - currentHour) <= 1)) {
      insights.push(`You're in a high-risk time period based on your patterns`);
    }

    if (patterns.averageIntensity && currentAnalysis.intensity > patterns.averageIntensity + 2) {
      insights.push(`This intensity is higher than your usual - extra support might help`);
    }

    return insights;
  }

  // Generate proactive recommendations
  generateRecommendations(userProfile) {
    const { patterns = {} } = userProfile;
    const recommendations = [];

    if (patterns.riskTimes && patterns.riskTimes.length > 0) {
      recommendations.push(`Consider planning activities during your high-risk times: ${patterns.riskTimes.join(', ')}`);
    }

    if (patterns.mostCommonTrigger) {
      recommendations.push(`Work on a coping plan specifically for ${patterns.mostCommonTrigger}`);
    }

    return recommendations;
  }

  // Helper methods
  countOccurrences(arr) {
    return arr.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {});
  }

  detectEmotionFallback(message) {
    const emotions = {
      'stress': ['stressed', 'overwhelmed', 'pressure', 'deadline', 'anxious'],
      'sad': ['sad', 'depressed', 'down', 'lonely', 'empty'],
      'bored': ['bored', 'nothing to do', 'mindless', 'restless'],
      'angry': ['angry', 'frustrated', 'mad', 'annoyed']
    };
    
    const lowerText = message.toLowerCase();
    for (const [emotion, keywords] of Object.entries(emotions)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return emotion;
      }
    }
    return 'neutral';
  }

  buildConversationContext(conversations, emotionalAnalysis, agentAction) {
    // Return last 6 messages with emotional context
    const recentConversations = conversations.slice(-6);
    
    // Add agent action context
    if (agentAction.type === 'pattern_based_support') {
      recentConversations.unshift({
        role: 'system',
        content: `User is experiencing a known trigger pattern. Focus on established coping strategies.`
      });
    }
    
    return recentConversations;
  }

  updateUserProfile(userId, interaction) {
    const profile = this.userProfiles.get(userId) || {};
    
    // Add to conversation history
    if (!profile.conversationHistory) profile.conversationHistory = [];
    profile.conversationHistory.push({
      timestamp: new Date().toISOString(),
      ...interaction
    });
    
    // Keep only last 50 interactions
    if (profile.conversationHistory.length > 50) {
      profile.conversationHistory = profile.conversationHistory.slice(-50);
    }
    
    this.userProfiles.set(userId, profile);
  }
}

module.exports = EmotionalEatingAgent;