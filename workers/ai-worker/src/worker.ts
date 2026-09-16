export interface AiJob { id: string; userId: string; type: 'embedding' | 'retrieval' | 'summary'; input: unknown; }

export async function processAiJob(job: AiJob): Promise<void> {
  // Queue consumer boundary for embeddings, retrieval and summarization.
  // Real provider calls must be configured; no synthetic AI output is generated here.
  void job;
}
