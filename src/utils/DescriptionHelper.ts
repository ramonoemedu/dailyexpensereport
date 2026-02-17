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
  // If user already picked a specific category, don't override it unless it's empty or generic
  const genericCategories = ["Uncategorized", "General/Other", "Other", "", "N/A"];
  if (currentCategory && !genericCategories.includes(currentCategory)) {
    return currentCategory;
  }
  
  const desc = description.toLowerCase();
  
  // Food & Drinks
  if (
    desc.includes("café") || desc.includes("coffee") || desc.includes("lunch") || 
    desc.includes("dinner") || desc.includes("food") || desc.includes("restaurant") || 
    desc.includes("drink") || desc.includes("matcha") || desc.includes("coconut") ||
    desc.includes("bread") || desc.includes("water") || desc.includes("ice cream") ||
    desc.includes("burger") || desc.includes("pizza") || desc.includes("kfc") ||
    desc.includes("meat") || desc.includes("vegetable") || desc.includes("fruit") ||
    desc.includes("bakery") || desc.includes("noodle") || desc.includes("starbuck") ||
    desc.includes("soup") || desc.includes("oyster") || desc.includes("coke") ||
    desc.includes("coca") || desc.includes("beer") || desc.includes("wisky") ||
    desc.includes("swicky") || desc.includes("wine")
  ) return "Food & Drinks";

  // Transportation
  if (
    desc.includes("gasoline") || desc.includes("fuel") || desc.includes("taxi") || 
    desc.includes("grab") || desc.includes("car") || desc.includes("hometown") || 
    desc.includes("tuktuk") || desc.includes("passapp") || desc.includes("parking") ||
    desc.includes("moto") || desc.includes("bus") || desc.includes("trip") ||
    desc.includes("caltex") || desc.includes("totalenerg") || desc.includes("tela") ||
    desc.includes("ptt")
  ) return "Transportation";

  // Utilities
  if (
    desc.includes("electricity") || desc.includes("edc") || desc.includes("water bill") || 
    desc.includes("internet") || desc.includes("phone") || desc.includes("top up") || 
    desc.includes("mobile data") || desc.includes("cellcard") || desc.includes("smart") ||
    desc.includes("metfone") || desc.includes("refill") || desc.includes("wifi")
  ) return "Utilities";

  // Health
  if (
    desc.includes("health") || desc.includes("hospital") || desc.includes("doctor") || 
    desc.includes("medichine") || desc.includes("medicine") || desc.includes("pharmacy") ||
    desc.includes("dentist") || desc.includes("teeth") || desc.includes("sick") ||
    desc.includes("clinic") || desc.includes("vitamin") || desc.includes("supplement")
  ) return "Health";

  // Family
  if (
    desc.includes("mak") || desc.includes("pa") || desc.includes("pha") || 
    desc.includes("hea") || desc.includes("jee") || desc.includes("send to") || 
    desc.includes("family") || desc.includes("support") || desc.includes("parent") ||
    desc.includes("wife") || desc.includes("husband") || desc.includes("child") ||
    desc.includes("baby") || desc.includes("diaper") || desc.includes("milk powder")
  ) return "Family";

  // Shopping
  if (
    desc.includes("clothes") || desc.includes("shoes") || desc.includes("electronic") ||
    desc.includes("iphone") || desc.includes("gadget") || desc.includes("mall") ||
    desc.includes("shopping") || desc.includes("dress") || desc.includes("skirt") ||
    desc.includes("shirt") || desc.includes("watch") || desc.includes("lipstick") ||
    desc.includes("makeup") || desc.includes("make up") || desc.includes("skincare") ||
    desc.includes("shampoo") || desc.includes("soap") || desc.includes("nail") ||
    desc.includes("cream") || desc.includes("aeon") || desc.includes("lucky express") ||
    desc.includes("mart")
  ) return "Shopping";

  // Entertainment
  if (
    desc.includes("movie") || desc.includes("cinema") || desc.includes("game") || 
    desc.includes("netflix") || desc.includes("concert") || desc.includes("party") ||
    desc.includes("holiday") || desc.includes("vacation") || desc.includes("hotel") ||
    desc.includes("resort")
  ) return "Entertainment";

  // Education
  if (
    desc.includes("school") || desc.includes("university") || desc.includes("course") || 
    desc.includes("book") || desc.includes("training") || desc.includes("tuition")
  ) return "Education";

  // Investment
  if (
    desc.includes("invest") || desc.includes("stock") || desc.includes("crypto") || 
    desc.includes("property") || desc.includes("gold") || desc.includes("saving")
  ) return "Investment";

  // Gift & Donation
  if (
    desc.includes("gift") || desc.includes("donation") || desc.includes("present") || 
    desc.includes("wedding") || desc.includes("charity") || desc.includes("tip")
  ) return "Gift & Donation";
  
  return "Other";
}
