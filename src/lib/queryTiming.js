// Instrumentação leve de tempo para queries Supabase.
// Loga início e fim (com duração) de cada operação no console.
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export async function timeQuery(label, fn) {
  const start = now();
  console.info(`[perf] ${label} — início`);
  try {
    const result = await fn();
    console.info(`[perf] ${label} — fim em ${Math.round(now() - start)}ms`);
    return result;
  } catch (err) {
    console.warn(`[perf] ${label} — erro em ${Math.round(now() - start)}ms:`, err?.message || err);
    throw err;
  }
}
