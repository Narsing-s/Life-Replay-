export interface DocumentJob { documentId: string; userId: string; objectKey: string; mimeType: string; }

export async function processDocument(job: DocumentJob): Promise<void> {
  // Pipeline boundary: extract -> OCR -> classify -> chunk.
  // Provider implementations are intentionally injected later; this worker never fabricates OCR results.
  void job;
}
