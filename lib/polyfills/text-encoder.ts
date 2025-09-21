if (typeof window !== 'undefined') {
  const g: any = globalThis as any;
  g.util = g.util || {};
  if (!g.util.TextEncoder && (window as any).TextEncoder) {
    g.util.TextEncoder = (window as any).TextEncoder;
  }
  if (!g.util.TextDecoder && (window as any).TextDecoder) {
    g.util.TextDecoder = (window as any).TextDecoder;
  }
}

