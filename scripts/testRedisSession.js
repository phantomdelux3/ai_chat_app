const sessionService = require('../services/sessionService');

const testRedisSession = async () => {
  console.log('=== TESTING REDIS SESSION MANAGEMENT ===\n');
  
  try {
    // Create a test session
    const session = await sessionService.createSession('test-user');
    console.log('Created session:', session.id);

    // Test message storage
    await sessionService.saveMessage(session.id, 'user', 'I need wall posters for my room');
    await sessionService.saveMessage(session.id, 'assistant', 'I found some great wall posters for you!');
    
    // Test preferences
    const preferences = {
      interests: ['home decor'],
      price_range: 'under 2000',
      product_type: 'wall posters'
    };
    await sessionService.saveUserPreferences(session.id, preferences);

    // Test context
    await sessionService.updateConversationContext(session.id, {
      currentProductType: 'wall posters',
      mainInterests: ['home decor'],
      lastPriceRange: 'under 2000'
    });

    // Test retrieval
    console.log('\n🔍 Testing retrieval from Redis:');
    
    const cachedSession = await sessionService.getSession(session.id);
    console.log('Cached session:', cachedSession ? '✅' : '❌');

    const cachedMessages = await sessionService.getSessionMessages(session.id);
    console.log('Cached messages:', cachedMessages.length);

    const cachedPreferences = await sessionService.getUserPreferences(session.id);
    console.log('Cached preferences:', cachedPreferences ? '✅' : '❌');

    const cachedContext = await sessionService.getConversationContext(session.id);
    console.log('Cached context:', cachedContext);

    // Test cache stats
    const stats = await sessionService.getSessionStats(session.id);
    console.log('\n📊 Cache stats:', stats);

    // Cleanup
    await sessionService.clearSessionCache(session.id);
    console.log('\n🧹 Cache cleared');

  } catch (error) {
    console.error('Test failed:', error);
  }
};

testRedisSession();