export class TfIdf {
  private documents: Map<string, string[]> = new Map();
  private docFrequencies: Map<string, number> = new Map();
  private totalDocs = 0;

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((term) => term.length > 2);
  }

  public addDocument(id: string, text: string): void {
    const tokens = this.tokenize(text);
    this.documents.set(id, tokens);
    this.totalDocs++;

    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      this.docFrequencies.set(token, (this.docFrequencies.get(token) || 0) + 1);
    }
  }

  public computeVector(text: string): Map<string, number> {
    const tokens = this.tokenize(text);
    const termFrequencies = new Map<string, number>();
    for (const token of tokens) {
      termFrequencies.set(token, (termFrequencies.get(token) || 0) + 1);
    }

    const vector = new Map<string, number>();
    for (const [term, freq] of termFrequencies.entries()) {
      const tf = freq / tokens.length;
      const df = this.docFrequencies.get(term) || 1;
      const idf = Math.log((this.totalDocs + 1) / (df + 1)) + 1;
      vector.set(term, tf * idf);
    }

    return vector;
  }

  public static cosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const val of vecA.values()) {
      normA += val * val;
    }
    for (const val of vecB.values()) {
      normB += val * val;
    }

    if (normA === 0 || normB === 0) return 0;

    for (const [term, valA] of vecA.entries()) {
      const valB = vecB.get(term);
      if (valB !== undefined) {
        dotProduct += valA * valB;
      }
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

