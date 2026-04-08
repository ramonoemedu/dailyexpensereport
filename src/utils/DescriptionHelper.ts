/**
 * Utility to refine and correct descriptions.
 * In a real-world scenario, this could call an LLM or a grammar API.
 * Here it provides smart local corrections and formatting.
 */
export function refineDescription(text: string): string {
  if (!text) return "";

  let refined = text.trim();

  // 1. Basic Grammar: Capitalize first letter
  refined = refined.charAt(0).toUpperCase() + refined.slice(1);

  // 2. Common typo corrections / Normalization
  const commonCorrections: Record<string, string> = {
    "Husband": "Husband",
    "husban": "Husband",
    "salary": "Salary",
    "salery": "Salary",
    "incum": "Income",
    "expens": "Expense",
    "recept": "Receipt",
    "mcdonald": "McDonald's",
    "starbuck": "Starbucks",
    "grab car": "GrabCar",
    "foodpanda": "FoodPanda",
  };

  Object.entries(commonCorrections).forEach(([typo, correct]) => {
    const regex = new RegExp(`\\b${typo}\\b`, 'gi');
    refined = refined.replace(regex, correct);
  });

  return refined;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function levenshteinDistance(source: string, target: string): number {
  if (source === target) return 0;
  if (!source.length) return target.length;
  if (!target.length) return source.length;

  const previousRow = Array.from({ length: target.length + 1 }, (_, index) => index);

  for (let i = 1; i <= source.length; i += 1) {
    const currentRow = [i];
    for (let j = 1; j <= target.length; j += 1) {
      const insertion = currentRow[j - 1] + 1;
      const deletion = previousRow[j] + 1;
      const substitution = previousRow[j - 1] + (source[i - 1] === target[j - 1] ? 0 : 1);
      currentRow.push(Math.min(insertion, deletion, substitution));
    }
    for (let j = 0; j < previousRow.length; j += 1) {
      previousRow[j] = currentRow[j];
    }
  }

  return previousRow[target.length];
}

function isApproximateTokenMatch(source: string, target: string): boolean {
  if (!source || !target) return false;
  if (source.includes(target) || target.includes(source)) return true;

  const maxDistance = target.length <= 4 ? 1 : 2;
  return levenshteinDistance(source, target) <= maxDistance;
}

function matchesKeyword(description: string, keyword: string): boolean {
  const normalizedDescription = normalizeText(description);
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedDescription || !normalizedKeyword) return false;

  if (normalizedDescription.includes(normalizedKeyword)) return true;

  const descriptionCompact = normalizedDescription.replace(/\s+/g, '');
  const keywordCompact = normalizedKeyword.replace(/\s+/g, '');
  if (descriptionCompact.includes(keywordCompact)) return true;

  const descriptionTokens = normalizedDescription.split(' ');
  const keywordTokens = normalizedKeyword.split(' ');

  return keywordTokens.every((keywordToken) =>
    descriptionTokens.some((descriptionToken) => isApproximateTokenMatch(descriptionToken, keywordToken))
  );
}

const CATEGORY_RULES: Array<{ category: string; keywords: string[] }> = [
  {
    category: 'Food & Drinks',
    keywords: [
      'café', 'coffee', 'cofee', 'cafe', 'lunch', 'dinner', 'food', 'restaurant', 'drink', 'matcha',
      'coconut', 'bread', 'water', 'wter', 'ice cream', 'burger', 'pizza', 'kfc', 'meat', 'vegetable',
      'fruit', 'bakery', 'noodle', 'starbuck', 'starbucks', 'soup', 'oyster', 'coke', 'coca', 'beer',
      'wisky', 'swicky', 'wine', 'meal', 'snack', 'tea', 'juice'
    ],
  },
  {
    category: 'Transportation',
    keywords: [
      'gasoline', 'fuel', 'taxi', 'grab', 'car', 'hometown', 'tuktuk', 'passapp', 'parking', 'moto',
      'bus', 'trip', 'caltex', 'totalenerg', 'tela', 'ptt', 'ride', 'transport'
    ],
  },
  {
    category: 'Utilities',
    keywords: [
      'electricity', 'edc', 'water bill', 'water', 'internet', 'phone', 'top up', 'mobile data',
      'cellcard', 'smart', 'metfone', 'refill', 'wifi', 'utility', 'bill'
    ],
  },
  {
    category: 'Health',
    keywords: [
      'health', 'hospital', 'doctor', 'medichine', 'medicine', 'pharmacy', 'dentist', 'teeth', 'sick',
      'clinic', 'vitamin', 'supplement', 'medical'
    ],
  },
  {
    category: 'Family',
    keywords: [
      'mak', 'pa', 'pha', 'hea', 'jee', 'send to', 'family', 'help family', 'support', 'parent', 'wife',
      'husband', 'child', 'baby', 'diaper', 'milk powder', 'famly', 'family help', 'family support'
    ],
  },
  {
    category: 'Shopping',
    keywords: [
      'clothes', 'shoes', 'electronic', 'iphone', 'gadget', 'mall', 'shopping', 'dress', 'skirt', 'shirt',
      'watch', 'lipstick', 'makeup', 'make up', 'skincare', 'shampoo', 'soap', 'nail', 'cream', 'aeon',
      'lucky express', 'mart', 'store', 'purchase'
    ],
  },
  {
    category: 'Entertainment',
    keywords: [
      'movie', 'cinema', 'game', 'netflix', 'concert', 'party', 'holiday', 'vacation', 'hotel', 'resort',
      'fun', 'entertainment'
    ],
  },
  {
    category: 'Education',
    keywords: ['school', 'university', 'course', 'book', 'training', 'tuition', 'study', 'class'],
  },
  {
    category: 'Investment',
    keywords: ['invest', 'stock', 'crypto', 'property', 'gold', 'saving', 'savings'],
  },
  {
    category: 'Gift & Donation',
    keywords: ['gift', 'donation', 'present', 'wedding', 'charity', 'tip', 'contribution'],
  },
];

/**
 * Filters the unique descriptions intelligently
 */
export function getSmartSuggestions(input: string, allDescriptions: string[]): string[] {
  if (!input) return [];
  const search = input.toLowerCase();
  
  return allDescriptions
    .filter(desc => desc.toLowerCase().includes(search))
    .sort((a, b) => {
      // Prioritize descriptions that start with the input
      const aStarts = a.toLowerCase().startsWith(search);
      const bStarts = b.toLowerCase().startsWith(search);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    })
    .slice(0, 10); // Show top 10 relevant matches
}

/**
 * Automatically categorizes a description based on keywords.
 */
export function autoCategorize(description: string, currentCategory?: string): string {
  // If user already picked a specific category, don't override it unless it's empty or generic
  const genericCategories = ["Uncategorized", "General/Other", "Other", "", "N/A"];
  if (currentCategory && !genericCategories.includes(currentCategory)) {
    return currentCategory;
  }

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => matchesKeyword(description, keyword))) {
      return rule.category;
    }
  }

  return "Other";
}
