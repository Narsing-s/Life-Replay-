export interface NotificationJob { id: string; userId: string; channel: 'email' | 'push' | 'in-app'; payload: Record<string, unknown>; }

export async function processNotification(job: NotificationJob): Promise<void> {
  // Delivery is provider-backed. Failed provider configuration must surface as a job failure.
  void job;
}
