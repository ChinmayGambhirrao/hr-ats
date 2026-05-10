let extractor: unknown = null;

/** Dynamic import avoids loading ONNX/transformers at cold start when unused (fixes Vercel crashes / HTML error pages). */
async function loadPipeline() {
  const { pipeline } = await import("@xenova/transformers");
  return pipeline;
}

/**
 * On Vercel serverless, downloading and running the embedding model often hits
 * cold-start time / memory limits and returns 504 — so semantic scoring is off
 * unless ENABLE_SEMANTIC_SCORING=true (and a long enough maxDuration on Pro).
 */
function shouldUseSemanticEmbeddings(): boolean {
  if (process.env.ENABLE_SEMANTIC_SCORING === "true") return true;
  if (process.env.ENABLE_SEMANTIC_SCORING === "false") return false;
  return process.env.VERCEL !== "1";
}

async function getEmbeddingModel() {
  if (!extractor) {
    const pipeline = await loadPipeline();
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractor;
}

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/);
  const stopwords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", 
    "with", "by", "is", "are", "am", "was", "were", "be", "been", "being",
    "have", "has", "had", "having", "do", "does", "did", "doing", "of", "that"
  ]);
  
  const keywords = words.filter(w => 
    w.length > 3 && !stopwords.has(w) && /^[a-z]+$/.test(w)
  );
  
  return [...new Set(keywords)].slice(0, 100);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] ** 2;
    magB += b[i] ** 2;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export async function calculateATSScore(resumeText: string, jobText: string) {
  const resumeKeywords = extractKeywords(resumeText);
  const jobKeywords = extractKeywords(jobText);
  
  const matchedKeywords = resumeKeywords.filter(k => jobKeywords.includes(k));
  const missingKeywords = jobKeywords.filter(k => !resumeKeywords.includes(k));
  
  const keywordScore = jobKeywords.length > 0 
    ? (matchedKeywords.length / jobKeywords.length) * 100 
    : 0;

  const keywordOnly = {
    score: Math.round(keywordScore),
    matchedKeywords,
    missingKeywords,
    keywordScore: Math.round(keywordScore),
    semanticScore: 0
  };

  if (!shouldUseSemanticEmbeddings()) {
    return keywordOnly;
  }

  try {
    const model = (await getEmbeddingModel()) as (
      text: string,
      opts: { pooling: string }
    ) => Promise<{ data: ArrayLike<number> }>;

    const resumeEmbedding = await model(resumeText.slice(0, 3000), { pooling: "mean" });
    const jobEmbedding = await model(jobText.slice(0, 3000), { pooling: "mean" });

    const similarity = cosineSimilarity(
      Array.from(resumeEmbedding.data),
      Array.from(jobEmbedding.data)
    );

    const semanticScore = similarity * 100;
    const finalScore = Math.round(keywordScore * 0.4 + semanticScore * 0.6);

    return {
      score: Math.min(100, Math.max(0, finalScore)),
      matchedKeywords,
      missingKeywords,
      keywordScore: Math.round(keywordScore),
      semanticScore: Math.round(semanticScore)
    };
  } catch (error) {
    console.error("Semantic scoring failed:", error);
    return keywordOnly;
  }
}