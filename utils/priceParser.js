class PriceParser {
  static parsePrice(input) {
    if (!input) return null;
    
    const text = input.toString().toLowerCase().trim();
    
    // Remove common currency words and symbols
    const cleaned = text
      .replace(/[₹$,]/g, '') // Remove currency symbols
      .replace(/\b(rupees|rs|bucks|inr)\b/g, '') // Remove currency words
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    console.log('Price parsing - input:', input, 'cleaned:', cleaned);

    // Try different parsing methods
    return this.parseNumericFormat(cleaned) ||
           this.parseWordFormat(cleaned) ||
           this.parseKFormat(cleaned) ||
           this.parseRangeFormat(cleaned) ||
           this.parseComparativeFormat(cleaned);
  }

  static parseNumericFormat(text) {
    // Match numbers like 1000, 1,000, 1000.50
    const numericMatch = text.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
    if (numericMatch) {
      const number = parseFloat(numericMatch[1].replace(/,/g, ''));
      return !isNaN(number) ? Math.round(number) : null;
    }
    return null;
  }

  static parseKFormat(text) {
    // Match formats like 1k, 1.5k, 2.2k, 1.5 thousand
    const kMatch = text.match(/(\d+(?:\.\d+)?)\s*k(?:\s*|$)/) || 
                   text.match(/(\d+(?:\.\d+)?)\s*thousand/);
    if (kMatch) {
      const number = parseFloat(kMatch[1]) * 1000;
      return !isNaN(number) ? Math.round(number) : null;
    }
    return null;
  }

  static parseWordFormat(text) {
    const wordNumbers = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
      'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
      'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
      'eighty': 80, 'ninety': 90
    };

    const multipliers = {
      'hundred': 100,
      'thousand': 1000,
      'lakh': 100000,
      'lac': 100000,
      'crore': 10000000
    };

    // Simple word to number conversion for common patterns
    if (text.includes('thousand')) {
      const numberMatch = text.match(/(\w+)\s*thousand/);
      if (numberMatch && wordNumbers[numberMatch[1]]) {
        return wordNumbers[numberMatch[1]] * 1000;
      }
    }

    // Handle "two thousand", "five hundred" etc.
    const words = text.split(/\s+/);
    let total = 0;
    let current = 0;

    for (const word of words) {
      if (wordNumbers[word]) {
        current += wordNumbers[word];
      } else if (multipliers[word]) {
        if (current === 0) current = 1;
        total += current * multipliers[word];
        current = 0;
      }
    }

    return total + current || null;
  }

  static parseRangeFormat(text) {
    // Match ranges like 500-1000, 500 to 1000, 500 - 1000
    const rangeMatch = text.match(/(\d+)\s*(?:-|to)\s*(\d+)/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1]);
      const max = parseInt(rangeMatch[2]);
      if (!isNaN(min) && !isNaN(max)) {
        return { min, max, type: 'range' };
      }
    }
    return null;
  }

  static parseComparativeFormat(text) {
    // Match comparative phrases and extract the number
    const patterns = [
      { regex: /(?:under|below|less than|upto|max|maximum)\s*(\d+(?:\.\d+)?k?)/, type: 'max' },
      { regex: /(?:over|above|more than|min|minimum)\s*(\d+(?:\.\d+)?k?)/, type: 'min' },
      { regex: /(\d+(?:\.\d+)?k?)\s*(?:or below|and below|and less)/, type: 'max' },
      { regex: /(\d+(?:\.\d+)?k?)\s*(?:or above|and above|and more)/, type: 'min' }
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const numberText = match[1];
        let number = this.parsePrice(numberText); // Recursively parse the number part
        
        if (number && typeof number === 'number') {
          if (pattern.type === 'max') {
            return { max: number, type: 'max' };
          } else {
            return { min: number, type: 'min' };
          }
        }
      }
    }
    return null;
  }

  static convertToPriceRange(priceInfo) {
    if (!priceInfo) return null;

    console.log('Converting to price range:', priceInfo);

    // If it's already a range object
    if (typeof priceInfo === 'object' && priceInfo.type) {
      if (priceInfo.type === 'range' && priceInfo.min && priceInfo.max) {
        return { min: priceInfo.min, max: priceInfo.max };
      }
      if (priceInfo.type === 'max' && priceInfo.max) {
        return { min: 0, max: priceInfo.max };
      }
      if (priceInfo.type === 'min' && priceInfo.min) {
        return { min: priceInfo.min, max: 100000 }; // Large upper limit
      }
    }

    // If it's a single number, treat it as a maximum budget
    if (typeof priceInfo === 'number') {
      return { min: 0, max: priceInfo };
    }

    return null;
  }

  // Main method to extract price range from any text
  static extractPriceRange(text) {
    console.log('Extracting price range from:', text);
    
    const priceInfo = this.parsePrice(text);
    console.log('Parsed price info:', priceInfo);
    
    const priceRange = this.convertToPriceRange(priceInfo);
    console.log('Final price range:', priceRange);
    
    return priceRange;
  }


   static getSmartPriceRanges(targetMaxPrice) {
    console.log(`Getting smart price ranges for target: ${targetMaxPrice}`);
    
    // Define price brackets with priority
    const priceBrackets = [
      { min: targetMaxPrice * 0.8, max: targetMaxPrice, priority: 1, label: 'close_to_budget' },      // 80-100% of budget
      { min: targetMaxPrice * 0.6, max: targetMaxPrice * 0.8, priority: 2, label: 'good_value' },     // 60-80% of budget
      { min: targetMaxPrice * 0.4, max: targetMaxPrice * 0.6, priority: 3, label: 'affordable' },     // 40-60% of budget
      { min: targetMaxPrice * 0.2, max: targetMaxPrice * 0.4, priority: 4, label: 'budget' },         // 20-40% of budget
      { min: 0, max: targetMaxPrice * 0.2, priority: 5, label: 'economy' }                           // 0-20% of budget
    ];

    // For very low budgets, adjust the brackets
    if (targetMaxPrice < 1000) {
      return [
        { min: targetMaxPrice * 0.7, max: targetMaxPrice, priority: 1, label: 'close_to_budget' },
        { min: targetMaxPrice * 0.4, max: targetMaxPrice * 0.7, priority: 2, label: 'affordable' },
        { min: 0, max: targetMaxPrice * 0.4, priority: 3, label: 'economy' }
      ];
    }

    return priceBrackets;
  }

  static extractPriceRangeWithStrategy(text) {
    console.log('Extracting price range with smart strategy:', text);
    
    const baseRange = this.extractPriceRange(text);
    if (!baseRange) return null;

    // Get smart price brackets for the target max price
    const smartRanges = this.getSmartPriceRanges(baseRange.max);
    
    return {
      baseRange: baseRange,
      smartRanges: smartRanges,
      strategy: 'progressive'
    };
  }
}



module.exports = PriceParser;