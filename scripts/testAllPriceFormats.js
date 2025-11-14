const PriceParser = require('../utils/priceParser');

const testCases = [
  // Numeric formats
  '1000', '1,000', '1500', '2.5k', '1k', '1.5k',
  // Word formats  
  'one thousand', 'two thousand', 'fifteen hundred', 'five hundred',
  // Currency formats
  '1000 rupees', '₹1000', '1000 bucks', '1000 rs', '1k rupees',
  // Range formats
  '500-1000', '500 to 1000', 'between 500 and 1000',
  // Comparative formats
  'under 1000', 'less than 2000', 'below 1.5k', 'over 500', 'above 2k',
  'maximum 1000', 'minimum 500', 'upto 2000',
  // Mixed formats
  'under 1k rupees', 'less than two thousand bucks', 'around 1.5k',
  'budget is 2000', 'max budget 1500', 'price under 1000 rupees'
];

console.log('Testing all price formats:\n');

testCases.forEach(testCase => {
  const result = PriceParser.extractPriceRange(testCase);
  console.log(`"${testCase}" → ${result}`);
});

// Test edge cases
console.log('\nEdge cases:');
const edgeCases = [
  'I want something cheap', // should detect affordable range
  'show me luxury items',   // should detect expensive range
  'no price mentioned',     // should return null
  'random text with 500 in it', // should detect 500
  'between five hundred and one thousand' // word range
];

edgeCases.forEach(testCase => {
  const result = PriceParser.extractPriceRange(testCase);
  console.log(`"${testCase}" → ${result}`);
});