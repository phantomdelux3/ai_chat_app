const express = require('express');
const router = express.Router();
const databaseService = require('../services/databaseService');

router.get('/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50 } = req.query;

    const messages = await databaseService.getSessionMessages(sessionId, parseInt(limit));
    
    // Get product recommendations for each assistant message
    const messagesWithProducts = await Promise.all(
      messages.map(async (message) => {
        if (message.role === 'assistant') {
          const products = await databaseService.getMessageRecommendations(message.id);
          return {
            ...message,
            products: products.map(p => ({
              id: p.product_id,
              title: p.product_title,
              price: p.product_price,
              url: p.product_url,
              image: p.product_image,
              rank: p.rank
            }))
          };
        }
        return message;
      })
    );

    res.json({
      sessionId,
      messages: messagesWithProducts
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
});

router.get('/:sessionId/preferences', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const preferences = await databaseService.getUserPreferences(sessionId);
    
    res.json({
      sessionId,
      preferences: preferences || {}
    });

  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to retrieve preferences' });
  }
});

module.exports = router;