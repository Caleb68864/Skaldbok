export async function shareFile(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename);
  if (
    typeof navigator !== 'undefined' &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({ files: [file], title: filename });
  } else {
    downloadBlob(blob, filename);
  }
}

export async function copyToClipboard(markdown: string): Promise<void> {
  await navigator.clipboard.writeText(markdown);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
