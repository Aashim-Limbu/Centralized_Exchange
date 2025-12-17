export async function safe<T>(
  fn: () => Promise<T>,
  onError?: (err: unknown) => void
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    onError?.(err);
    return null;
  }
}
