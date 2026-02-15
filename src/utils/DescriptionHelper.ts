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
    const regex = new RegExp(`\b${typo}\b`, 'gi');
    refined = refined.replace(regex, correct);
  });

  return refined;
}

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
