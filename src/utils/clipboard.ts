/**
 * Utility to safely copy text to the clipboard, even within restricted iframe contexts.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern navigator.clipboard API if available and secure
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('[Clipboard] navigator.clipboard.writeText blocked or failed:', err);
    }
  }

  // 2. Fallback: DOM-based execCommand copy (resilient inside sandboxed iframes)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    document.body.appendChild(textArea);

    if (navigator.userAgent.match(/ipad|ipod|iphone/i)) {
      const range = document.createRange();
      range.selectNodeContents(textArea);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      textArea.setSelectionRange(0, 999999);
    } else {
      textArea.select();
    }

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (fallbackErr) {
    console.error('[Clipboard] ExecCommand fallback copy failed:', fallbackErr);
    return false;
  }
}

/**
 * Dispatch a global application-level error event for copyable toast banner
 */
export function notifyAppError(message: string, title?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('educbt:error', {
        detail: { message, title: title || 'Kendala Layanan' },
      })
    );
  }
}
