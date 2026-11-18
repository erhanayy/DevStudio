/**
 * Google Gemini API Candidate Text Extractor
 * 
 * CRITICAL: Gemini responses often split text across multiple items in the `parts` array
 * (e.g. thoughts, code blocks, or token chunks).
 * Accessing only `parts[0].text` will SILENTLY DROP the rest of the response!
 * This helper joins all valid text parts together into a seamless string.
 */
export function extractGeminiText(jsonOrCandidates: any): string {
  if (!jsonOrCandidates) return "";
  
  let candidates = jsonOrCandidates;
  if (jsonOrCandidates.candidates && Array.isArray(jsonOrCandidates.candidates)) {
    candidates = jsonOrCandidates.candidates;
  }
  
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  
  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  
  return parts
    .filter((p: any) => p && typeof p.text === "string")
    .map((p: any) => p.text)
    .join("");
}
