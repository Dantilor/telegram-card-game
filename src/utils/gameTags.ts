export function formatGameTags(description: string): string {
  return description.replace(/\n+/g, ' • ')
}
