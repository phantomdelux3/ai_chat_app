const redisClient = require('../config/redis');
const databaseService = require('./databaseService');

class SessionService {
  // Session cache key patterns
  static getSessionKey(sessionId) {
    return `session:${sessionId}`;
  }

  static getMessagesKey(sessionId) {
    return `session:${sessionId}:messages`;
  }

  static getPreferencesKey(sessionId) {
    return `session:${sessionId}:preferences`;
  }

  static getContextKey(sessionId) {
    return `session:${sessionId}:context`;
  }

  // Get or create session with Redis caching
  async getSession(sessionId) {
    const cacheKey = this.constructor.getSessionKey(sessionId);
    
    // Try Redis first
    const cachedSession = await redisClient.get(cacheKey);
    if (cachedSession) {
      console.log('✅ Session loaded from Redis');
      return cachedSession;
    }

    // Fallback to database
    console.log('🔄 Session not in Redis, loading from database');
    const dbSession = await databaseService.getSession(sessionId);
    
    if (dbSession) {
      // Cache the session
      await redisClient.set(cacheKey, dbSession);
      console.log('✅ Session cached to Redis');
    }

    return dbSession;
  }

  // Create new session and cache it
  async createSession(userId = null) {
    const dbSession = await databaseService.createSession(userId);
    
    // Cache the new session
    const cacheKey = this.constructor.getSessionKey(dbSession.id);
    await redisClient.set(cacheKey, dbSession);
    
    console.log('✅ New session created and cached');
    return dbSession;
  }

  // Get session messages with Redis caching
  async getSessionMessages(sessionId, limit = 50) {
    const cacheKey = this.constructor.getMessagesKey(sessionId);
    
    // Try Redis first
    const cachedMessages = await redisClient.get(cacheKey);
    if (cachedMessages) {
      console.log('✅ Messages loaded from Redis');
      return cachedMessages.slice(0, limit);
    }

    // Fallback to database
    console.log('🔄 Messages not in Redis, loading from database');
    const dbMessages = await databaseService.getSessionMessages(sessionId, 100); // Get more for cache
    
    if (dbMessages.length > 0) {
      // Cache the messages
      await redisClient.set(cacheKey, dbMessages);
      console.log(`✅ ${dbMessages.length} messages cached to Redis`);
    }

    return dbMessages.slice(0, limit);
  }

  // Save message and update Redis cache
  async saveMessage(sessionId, role, content) {
    // Save to database
    const message = await databaseService.saveMessage(sessionId, role, content);
    
    // Update Redis cache
    await this.updateMessagesCache(sessionId, message);
    
    return message;
  }

  // Update messages cache when new message is added
  async updateMessagesCache(sessionId, newMessage) {
    const cacheKey = this.constructor.getMessagesKey(sessionId);
    
    try {
      const currentMessages = await redisClient.get(cacheKey) || [];
      
      // Add new message and keep only last 100 messages in cache
      const updatedMessages = [...currentMessages, newMessage].slice(-100);
      
      await redisClient.set(cacheKey, updatedMessages);
      console.log('✅ Messages cache updated in Redis');
    } catch (error) {
      console.error('Error updating messages cache:', error);
      // Invalidate cache on error
      await redisClient.del(cacheKey);
    }
  }

  // Get user preferences with Redis caching
  async getUserPreferences(sessionId) {
    const cacheKey = this.constructor.getPreferencesKey(sessionId);
    
    // Try Redis first
    const cachedPreferences = await redisClient.get(cacheKey);
    if (cachedPreferences) {
      console.log('✅ Preferences loaded from Redis');
      return cachedPreferences;
    }

    // Fallback to database
    console.log('🔄 Preferences not in Redis, loading from database');
    const dbPreferences = await databaseService.getUserPreferences(sessionId);
    
    if (dbPreferences) {
      // Cache the preferences
      await redisClient.set(cacheKey, dbPreferences);
      console.log('✅ Preferences cached to Redis');
    }

    return dbPreferences;
  }

  // Save user preferences and update Redis cache
  async saveUserPreferences(sessionId, preferences) {
    // Save to database
    const savedPreferences = await databaseService.saveUserPreferences(sessionId, preferences);
    
    // Update Redis cache
    const cacheKey = this.constructor.getPreferencesKey(sessionId);
    await redisClient.set(cacheKey, savedPreferences);
    console.log('✅ Preferences cached to Redis');
    
    return savedPreferences;
  }

  // Get conversation context (summarized context for quick access)
  async getConversationContext(sessionId) {
    const cacheKey = this.constructor.getContextKey(sessionId);
    
    const context = await redisClient.get(cacheKey) || {
      currentProductType: null,
      mainInterests: [],
      lastPriceRange: null,
      conversationSummary: '',
      lastQuery: ''
    };
    
    return context;
  }

  // Update conversation context
  async updateConversationContext(sessionId, contextUpdate) {
    const cacheKey = this.constructor.getContextKey(sessionId);
    
    const currentContext = await this.getConversationContext(sessionId);
    const updatedContext = { ...currentContext, ...contextUpdate };
    
    await redisClient.set(cacheKey, updatedContext);
    console.log('✅ Conversation context updated in Redis');
    
    return updatedContext;
  }

  // Clear session cache (useful for testing or session reset)
  async clearSessionCache(sessionId) {
    const keys = [
      this.constructor.getSessionKey(sessionId),
      this.constructor.getMessagesKey(sessionId),
      this.constructor.getPreferencesKey(sessionId),
      this.constructor.getContextKey(sessionId)
    ];

    for (const key of keys) {
      await redisClient.del(key);
    }
    
    console.log('✅ Session cache cleared from Redis');
  }

  // Get session statistics
  async getSessionStats(sessionId) {
    const stats = {
      session: await redisClient.exists(this.constructor.getSessionKey(sessionId)),
      messages: await redisClient.exists(this.constructor.getMessagesKey(sessionId)),
      preferences: await redisClient.exists(this.constructor.getPreferencesKey(sessionId)),
      context: await redisClient.exists(this.constructor.getContextKey(sessionId))
    };
    
    return stats;
  }
}

module.exports = new SessionService();