const axios = require('axios');
const sessionService = require('../services/sessionService');

class OpenAIService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.baseURL = 'https://api.openai.com/v1';
  }

  async createChatCompletion(messages, temperature = 0.7, responseFormat = null) {
    try {
      const requestBody = {
        model: 'gpt-3.5-turbo',
        messages,
        temperature,
        max_tokens: 500
      };

      // Only add response_format for JSON responses (preference extraction)
      if (responseFormat) {
        requestBody.response_format = responseFormat;
      }

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API error:', error.response?.data || error.message);
      throw error;
    }
  }

async extractPreferences(userMessage, sessionId) {
    const conversationContext = await sessionService.getConversationContext(sessionId);
    const sessionMessages = await sessionService.getSessionMessages(sessionId);

    const systemPrompt = `You are a smart shopping assistant. Extract shopping preferences from user messages.

    Return a JSON object with exactly these fields:
    {
      "occasion": "string or null",
      "persona": "string or null", 
      "age": "string or null",
      "gender": "string or null",
      "interests": "array of strings or empty array",
      "price_range": "string or null",
      "product_type": "string or null",
      "search_query": "string - optimized search query for semantic search",
      "filters": "array of strings - specific filters to apply"
    }

    Guidelines:
    - product_type: Be specific but general enough for product matching (e.g., "wall posters", "bed sheets", "smartphones")
    - search_query: Create an optimized query for semantic search that captures the essence
    - filters: Suggest specific filters like ["home decor", "electronics", "clothing"]
    - Only carry forward context for clear follow-ups about price/attributes
    - Reset context when the topic clearly changes

    Examples:
    "i want aesthetic posters for my room" → {
      "product_type": "wall posters",
      "search_query": "aesthetic wall posters room decor",
      "filters": ["home decor"],
      "interests": ["home decor"]
    }
    
    "need a new smartphone under 30000" → {
      "product_type": "smartphones", 
      "search_query": "new smartphone mobile phone",
      "filters": ["electronics"],
      "price_range": "under 30000",
      "interests": ["tech"]
    }

    "show me running shoes for men" → {
      "product_type": "running shoes",
      "search_query": "men's running shoes sports footwear",
      "filters": ["clothing", "sports"],
      "interests": ["sports", "clothing"]
    }

    Return only valid JSON.`;

    const recentMessages = sessionMessages.slice(-4).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages,
      { role: 'user', content: userMessage }
    ];

    try {
      console.log('Extracting preferences with AI...');
      
      const response = await this.createChatCompletion(messages, 0.1, { type: "json_object" });
      
      let preferences;
      try {
        preferences = JSON.parse(response.trim());
        console.log('AI extracted preferences:', preferences);
      } catch (parseError) {
        console.log('Failed to parse AI response, using fallback');
        preferences = this.getFallbackPreferences(userMessage);
      }

      // Enhance with our price parser
      preferences = this.enhanceWithPriceDetection(preferences, userMessage);
      
      // Smart context management
      await this.updateSessionContext(sessionId, preferences, userMessage, conversationContext);
      
      console.log('Final preferences:', preferences);
      return preferences;
      
    } catch (error) {
      console.error('Error in extractPreferences:', error);
      return this.getFallbackPreferences(userMessage);
    }
  }

  enhanceWithPriceDetection(preferences, userMessage) {
    // Use our reliable price parser
    const priceRange = PriceParser.extractPriceRange(userMessage);
    if (priceRange && (!preferences.price_range || preferences.price_range === 'null')) {
      preferences.price_range = this.formatPriceRangeForOpenAI(priceRange);
    }
    
    return preferences;
  }

   async updateSessionContext(sessionId, preferences, userMessage, previousContext) {
    const contextUpdate = {
      lastQuery: userMessage.substring(0, 100),
      lastProductType: preferences.product_type,
      lastInterests: preferences.filters || preferences.interests || []
    };

    // Smart context carry-forward
    const shouldMaintainContext = this.shouldMaintainContext(userMessage, previousContext, preferences);
    
    if (shouldMaintainContext && previousContext.currentProductType) {
      contextUpdate.currentProductType = previousContext.currentProductType;
      contextUpdate.mainInterests = previousContext.mainInterests || [];
    } else {
      // New topic
      contextUpdate.currentProductType = preferences.product_type;
      contextUpdate.mainInterests = preferences.filters || preferences.interests || [];
    }

    if (preferences.price_range) {
      contextUpdate.lastPriceRange = preferences.price_range;
    }

    await sessionService.updateConversationContext(sessionId, contextUpdate);
  }

  shouldMaintainContext(currentMessage, previousContext, currentPreferences) {
    const message = currentMessage.toLowerCase();
    
    // Clear context reset triggers
    const resetTriggers = [
      'different', 'another', 'new', 'change', 'switch to',
      'now i want', 'how about', 'what about', 'also', 'next'
    ];
    
    if (resetTriggers.some(trigger => message.includes(trigger))) {
      return false;
    }
    
    // Maintain context for these follow-ups
    const followUpIndicators = [
      'under', 'less than', 'below', 'budget', 'cheaper', 'lower price',
      'make it', 'change to', 'how much', 'price', 'cost',
      'color', 'size', 'material', 'type', 'kind', 'style',
      'more', 'other', 'additional', 'similar'
    ];
    
    const isFollowUp = followUpIndicators.some(indicator => message.includes(indicator));
    const sameProductType = currentPreferences.product_type === previousContext.currentProductType;
    
    return isFollowUp && sameProductType;
  }

  getFallbackPreferences(userMessage) {
    const priceRange = PriceParser.extractPriceRange(userMessage);
    
    return {
      occasion: null,
      persona: null,
      age: null,
      gender: null,
      interests: [],
      price_range: priceRange ? this.formatPriceRangeForOpenAI(priceRange) : null,
      product_type: null,
      search_query: userMessage,
      filters: []
    };
  }

  getContextBasedPreferences(userMessage, conversationContext) {
    const interests = this.detectInterestsFromMessage(userMessage);
    const priceRange = PriceParser.extractPriceRange(userMessage);

    return {
      occasion: null,
      persona: null,
      age: null,
      gender: null,
      interests: interests.length > 0 ? interests : conversationContext.mainInterests,
      price_range: priceRange ? this.formatPriceRangeForOpenAI(priceRange) : conversationContext.lastPriceRange,
      product_type: conversationContext.currentProductType
    };
  }

  async updateContextFromPreferences(sessionId, preferences, userMessage) {
    const contextUpdate = {
      lastQuery: userMessage.substring(0, 100)
    };

    if (preferences.product_type) {
      contextUpdate.currentProductType = preferences.product_type;
    }

    if (preferences.interests && preferences.interests.length > 0) {
      contextUpdate.mainInterests = [...new Set([
        ...preferences.interests,
        ...(contextUpdate.mainInterests || [])
      ])].slice(0, 5); // Keep only top 5 interests
    }

    if (preferences.price_range) {
      contextUpdate.lastPriceRange = preferences.price_range;
    }

    await sessionService.updateConversationContext(sessionId, contextUpdate);
  }


  enhanceWithPriceParser(preferences, userMessage) {
    // If OpenAI didn't extract price well, use our parser
    if ((!preferences.price_range || preferences.price_range === 'null') && userMessage) {
      const extractedRange = PriceParser.extractPriceRange(userMessage);
      if (extractedRange) {
        console.log('Enhanced price range with parser:', extractedRange);
        preferences.price_range = this.formatPriceRangeForOpenAI(extractedRange);
      }
    }

    // Also use our parser as backup for interests
    if ((!preferences.interests || preferences.interests.length === 0) && userMessage) {
      const detectedInterests = this.detectInterestsFromMessage(userMessage);
      if (detectedInterests.length > 0) {
        preferences.interests = detectedInterests;
      }
    }

    return preferences;
  }

  formatPriceRangeForOpenAI(qdrantRange) {
    // Convert Qdrant range back to natural language for OpenAI context
    const rangeMap = {
      '0-500': 'under 500',
      '0-1000': 'under 1000',
      '1000-2000': '1000-2000',
      '2000-5000': '2000-5000',
      '5000-10000': '5000-10000',
      '10000+': 'over 10000'
    };
    return rangeMap[qdrantRange] || qdrantRange;
  }

  detectInterestsFromMessage(message) {
    const lowerMessage = message.toLowerCase();
    const interests = [];

    const interestKeywords = {
      'home decor': ['bed', 'sheet', 'pillow', 'blanket', 'curtain', 'furniture', 'decor', 'home', 'living room', 'bedroom', 'linen'],
      'tech': ['tech', 'gadget', 'electronic', 'phone', 'laptop', 'headphone', 'camera', 'smart'],
      'clothing': ['shirt', 'dress', 'cloth', 'wear', 'fashion', 'outfit', 'apparel'],
      'sports': ['sport', 'fitness', 'gym', 'exercise', 'running', 'training'],
      'books': ['book', 'read', 'novel', 'literature'],
      'music': ['music', 'song', 'instrument', 'guitar', 'piano'],
      'art': ['art', 'paint', 'design', 'creative', 'craft'],
      'travel': ['travel', 'luggage', 'bag', 'suitcase', 'backpack']
    };

    for (const [interest, keywords] of Object.entries(interestKeywords)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        interests.push(interest);
      }
    }

    return interests;
  }

  getDefaultPreferences(userMessage = '') {
    const interests = this.detectInterestsFromMessage(userMessage);
    const priceRange = PriceParser.extractPriceRange(userMessage);

    return {
      occasion: null,
      persona: null,
      age: null,
      gender: null,
      interests: interests,
      price_range: priceRange ? this.formatPriceRangeForOpenAI(priceRange) : null
    };
  }

  async generateAssistantResponse(userMessage, conversationHistory, recommendedProducts = []) {
    const systemPrompt = `You are a friendly gift recommendation assistant. Help users find perfect gifts.
    
    ${recommendedProducts.length > 0
        ? `I found ${recommendedProducts.length} products for you. Use this information naturally in conversation.`
        : 'I need more information to find the right products for you.'
      }
    
    Guidelines:
    - Be helpful and conversational
    - Ask about occasion, recipient, budget if missing
    - Mention available products naturally if we have them
    - Keep responses concise and engaging
    - Understand the conversation context and build upon it`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-6), // Last 6 messages for context
      { role: 'user', content: userMessage }
    ];

    try {
      // NO response_format here - we want natural conversation
      return await this.createChatCompletion(messages, 0.7);
    } catch (error) {
      console.error('Error generating assistant response:', error);
      return "I understand you're looking for items. Could you tell me more about what you need?";
    }
  }

  validatePreferences(preferences) {
    const defaultPrefs = this.getDefaultPreferences();

    return {
      occasion: preferences.occasion || defaultPrefs.occasion,
      persona: preferences.persona || defaultPrefs.persona,
      age: preferences.age || defaultPrefs.age,
      gender: preferences.gender || defaultPrefs.gender,
      interests: Array.isArray(preferences.interests) ? preferences.interests : defaultPrefs.interests,
      price_range: preferences.price_range || defaultPrefs.price_range
    };
  }

  getDefaultPreferences(userMessage = '') {
    const message = userMessage.toLowerCase();
    const interests = [];

    // Auto-detect home decor from common keywords
    const homeDecorKeywords = ['bed', 'sheet', 'pillow', 'blanket', 'curtain', 'furniture', 'decor', 'home', 'living room', 'bedroom'];
    if (homeDecorKeywords.some(keyword => message.includes(keyword))) {
      interests.push('home decor');
    }

    // Auto-detect price range
    let price_range = null;
    if (message.includes('under 1000') || message.includes('less than 1000')) {
      price_range = '0-1000';
    } else if (message.includes('under 500') || message.includes('less than 500')) {
      price_range = '0-500';
    }

    return {
      occasion: null,
      persona: null,
      age: null,
      gender: null,
      interests: interests,
      price_range: price_range
    };
  }
}

module.exports = new OpenAIService();