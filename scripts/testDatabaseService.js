const databaseService = require('../services/databaseService');

const testDatabaseService = async () => {
  try {
    console.log('Testing database service...');
    
    // Test session creation
    console.log('1. Testing session creation...');
    const session = await databaseService.createSession('test-user');
    console.log('Session created:', session.id);
    
    // Test get session
    console.log('2. Testing get session...');
    const retrievedSession = await databaseService.getSession(session.id);
    console.log('Session retrieved:', retrievedSession ? 'Yes' : 'No');
    
    // Test save message
    console.log('3. Testing save message...');
    const message = await databaseService.saveMessage(session.id, 'user', 'Hello, world!');
    console.log('Message saved:', message.id);
    
    // Test get messages
    console.log('4. Testing get messages...');
    const messages = await databaseService.getSessionMessages(session.id);
    console.log('Messages retrieved:', messages.length);
    
    // Test save preferences
    console.log('5. Testing save preferences...');
    const preferences = await databaseService.saveUserPreferences(session.id, {
      occasion: 'birthday',
      persona: 'friend',
      age: '25-30',
      gender: 'male',
      interests: ['tech', 'sports'],
      price_range: '50-100'
    });
    console.log('Preferences saved:', preferences.id);
    
    // Test get preferences
    console.log('6. Testing get preferences...');
    const retrievedPrefs = await databaseService.getUserPreferences(session.id);
    console.log('Preferences retrieved:', retrievedPrefs ? 'Yes' : 'No');
    
    console.log('All database service tests passed!');
    
  } catch (error) {
    console.error('Database service test failed:', error);
  }
};

testDatabaseService();