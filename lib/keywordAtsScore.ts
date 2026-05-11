/**
 * Keyword-only ATS scoring — no ML deps (safe for Vercel serverless).
 * Semantic embeddings live in lib/scoring.ts and are optional for local / Pro.
 */

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/);
  const stopwords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "with", "by", "is", "are", "am", "was", "were", "be", "been", "being",
    "have", "has", "had", "having", "do", "does", "did", "doing", "of", "that",
  ]);

  const keywords = words.filter(
    (w) => w.length > 3 && !stopwords.has(w) && /^[a-z]+$/.test(w)
  );

  return [...new Set(keywords)].slice(0, 100);
}

export function calculateKeywordAtsScore(resumeText: string, jobText: string) {
  const resumeKeywords = extractKeywords(resumeText);
  const jobKeywords = extractKeywords(jobText);

  const matchedKeywords = resumeKeywords.filter((k) => jobKeywords.includes(k));
  const missingKeywords = jobKeywords.filter((k) => !resumeKeywords.includes(k));

  const keywordScore =
    jobKeywords.length > 0
      ? (matchedKeywords.length / jobKeywords.length) * 100
      : 0;

  return {
    score: Math.round(keywordScore),
    matchedKeywords,
    missingKeywords,
    keywordScore: Math.round(keywordScore),
    semanticScore: 0,
  };
}
