#!/usr/bin/env python3
"""
Embedding Service - Flask API for sentence-transformers embeddings
This provides embeddings compatible with the existing Qdrant collection (384d)
"""

from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Initialize model
model = SentenceTransformer('all-MiniLM-L6-v2')
logging.info("Model loaded successfully: all-MiniLM-L6-v2 (384 dimensions)")

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model': 'all-MiniLM-L6-v2',
        'dimensions': 384
    })

@app.route('/embed', methods=['POST'])
def embed():
    """Generate embeddings for text"""
    try:
        data = request.json
        text = data.get('text', '')
        
        if not text:
            return jsonify({'error': 'Text is required'}), 400
        
        # Generate embedding
        embedding = model.encode(text).tolist()
        
        return jsonify({
            'embedding': embedding,
            'dimensions': len(embedding)
        })
    
    except Exception as e:
        logging.error(f"Error generating embedding: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/embed/batch', methods=['POST'])
def embed_batch():
    """Generate embeddings for multiple texts"""
    try:
        data = request.json
        texts = data.get('texts', [])
        
        if not texts or not isinstance(texts, list):
            return jsonify({'error': 'texts array is required'}), 400
        
        # Generate embeddings
        embeddings = model.encode(texts).tolist()
        
        return jsonify({
            'embeddings': embeddings,
            'count': len(embeddings),
            'dimensions': len(embeddings[0]) if embeddings else 0
        })
    
    except Exception as e:
        logging.error(f"Error generating embeddings: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
