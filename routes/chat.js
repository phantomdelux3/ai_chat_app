const express = require('express');
const router = express.Router();
const databaseService = require('../services/databaseService');
const openaiService = require('../services/openaiService');
const productService = require('../services/productService');
const sessionService = require('../services/sessionService');

router.post('/message', async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message are required' });
    }

    console.log('=== NEW CHAT MESSAGE ===');
    console.log('Session:', sessionId);
    console.log('Message:', message);

    // Get or create session using Redis
    let session = await sessionService.getSession(sessionId);
    if (!session) {
      console.log('Creating new session');
      session = await sessionService.createSession();
      sessionId = session.id;
    }

    // Log session cache stats
    const cacheStats = await sessionService.getSessionStats(sessionId);
    console.log('Session cache stats:', cacheStats);

    // Save user message to both DB and Redis
    const userMessage = await sessionService.saveMessage(sessionId, 'user', message);

    // Extract preferences using Redis context
    console.log('Extracting preferences with Redis context...');
    const preferences = await openaiService.extractPreferences(message, sessionId);
    console.log('Final preferences:', JSON.stringify(preferences, null, 2));
    
    // Save preferences to both DB and Redis
    if (preferences && Object.keys(preferences).length > 0) {
      await sessionService.saveUserPreferences(sessionId, preferences);
    }

    // Get product recommendations
    console.log('Getting product recommendations...');
    const products = await productService.recommendProducts(message, preferences, sessionId);
    console.log('Products found:', products.length);

    // Generate assistant response
    console.log('Generating assistant response...');
    const assistantResponse = await openaiService.generateAssistantResponse(
      message,
      await sessionService.getSessionMessages(sessionId),
      products
    );

    // Save assistant message to both DB and Redis
    const assistantMessage = await sessionService.saveMessage(
      sessionId,
      'assistant',
      assistantResponse
    );

    // Save product recommendations to DB only (no need for Redis cache)
    if (products.length > 0) {
      const databaseService = require('../services/databaseService');
      await databaseService.saveProductRecommendations(
        sessionId,
        assistantMessage.id,
        products
      );
    }

    console.log('=== CHAT COMPLETE ===');
    
    res.json({
      sessionId: session.id,
      assistantResponse,
      products: products,
      preferences
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process message', 
      details: error.message
    });
  }
});

// Add session management endpoints
router.get('/session/:sessionId/stats', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const stats = await sessionService.getSessionStats(sessionId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/session/:sessionId/cache', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await sessionService.clearSessionCache(sessionId);
    res.json({ message: 'Session cache cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/session', async (req, res) => {
  try {
    const { userId } = req.body;
    const session = await databaseService.createSession(userId);

    res.json({
      sessionId: session.id,
      createdAt: session.created_at
    });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get session details
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await databaseService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      sessionId: session.id,
      userId: session.user_id,
      createdAt: session.created_at,
      updatedAt: session.updated_at
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

module.exports = router;