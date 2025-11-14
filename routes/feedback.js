const express = require('express');
const router = express.Router();
const databaseService = require('../services/databaseService');

router.post('/product', async (req, res) => {
  try {
    const { sessionId, productRecommendationId, rating, reason } = req.body;

    if (!sessionId || !productRecommendationId || !rating) {
      return res.status(400).json({ 
        error: 'sessionId, productRecommendationId, and rating are required' 
      });
    }

    const feedback = await databaseService.saveFeedback(
      sessionId,
      productRecommendationId,
      rating,
      reason
    );

    res.json({
      feedbackId: feedback.id,
      message: 'Feedback saved successfully'
    });

  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

module.exports = router;