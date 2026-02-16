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

/**
 * Automatically categorizes a description based on keywords.
 */
export function autoCategorize(description: string, currentCategory?: string): string {
  // If user already picked a specific category, don't override it unless it's empty
  if (currentCategory && currentCategory !== "Uncategorized" && currentCategory !== "General/Other" && currentCategory !== "") {
    return currentCategory;
  }
  
  const desc = description.toLowerCase();
  
  // Food & Dining
  if (
    desc.includes("café") || desc.includes("lunch") || desc.includes("dinner") || 
    desc.includes("food") || desc.includes("restaurant") || desc.includes("drink") || 
    desc.includes("matcha") || desc.includes("coffee") || desc.includes("coconut") ||
    desc.includes("bread") || desc.includes("water") || desc.includes("ice cream") ||
    desc.includes("burger") || desc.includes("pizza") || desc.includes("kfc") ||
    desc.includes("meat") || desc.includes("vegetable") || desc.includes("fruit")
  ) return "Food & Dining";

  // Transportation
  if (
    desc.includes("gasoline") || desc.includes("taxi") || desc.includes("grab") || 
    desc.includes("car") || desc.includes("hometown") || desc.includes("tuktuk") ||
    desc.includes("passapp") || desc.includes("fuel") || desc.includes("parking")
  ) return "Transportation";

  // Utilities & Bills
  if (
    desc.includes("electricity") || desc.includes("water bill") || desc.includes("internet") || 
    desc.includes("phone") || desc.includes("top up") || desc.includes("mobile data")
  ) return "Utilities";

  // Salary/Income
  if (
    desc.includes("salary") || desc.includes("income") || desc.includes("bonus") || 
    desc.includes("receive") || desc.includes("interest")
  ) return "Salary/Income";

  // Personal Care
  if (
    desc.includes("nail") || desc.includes("cream") || desc.includes("skincare") || 
    desc.includes("body") || desc.includes("hair") || desc.includes("massage") ||
    desc.includes("shampoo") || desc.includes("soap")
  ) return "Personal Care";

  // Loans & Debt
  if (
    desc.includes("loan") || desc.includes("aeon") || desc.includes("interest") ||
    desc.includes("credit card") || desc.includes("pay back")
  ) return "Loans & Debt";

  // Family Support
  if (
    desc.includes("mak") || desc.includes("pa") || desc.includes("pha") || 
    desc.includes("hea") || desc.includes("send to") || desc.includes("family") ||
    desc.includes("support")
  ) return "Family Support";

  // Shopping
  if (
    desc.includes("clothes") || desc.includes("shoes") || desc.includes("electronic") ||
    desc.includes("iphone") || desc.includes("gadget") || desc.includes("mall")
  ) return "Shopping";
  
  return "General/Other";
}
