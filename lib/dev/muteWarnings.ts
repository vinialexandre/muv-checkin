let patched = false;
if (typeof window !== 'undefined' && !(window as any).__tfWarnPatched) {
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);
  console.warn = (...args: any[]) => {
    const s = args[0] ? String(args[0]) : '';
    if (
      s.includes('backend was already registered') ||
      (s.includes('kernel') && s.includes('already registered')) ||
      s.includes('Platform browser has already been set')
    ) {
      return;
    }
    origWarn(...args);
  };
  console.error = (...args: any[]) => {
    const s = args[0] ? String(args[0]) : '';
    if (s.includes('Critical dependency: require function')) return;
    origError(...args);
  };
  (window as any).__tfWarnPatched = true;
  patched = true;
}
export default patched;

