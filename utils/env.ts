
// Helper to safely access environment variables
// Handles both Vite (import.meta.env) and Webpack/CRA (process.env)
export const getEnv = (key: string): string | undefined => {
  let val = undefined;
  
  // 1. Try import.meta.env (Vite standard)
  try {
    // @ts-expect-error - import.meta.env is Vite specific
    if (typeof import.meta !== 'undefined' && import.meta.env) {
       // @ts-expect-error - import.meta.env is Vite specific
       val = import.meta.env[key] || import.meta.env[`VITE_${key}`];
    }
  } catch { /* Ignore errors accessing import.meta */ }
  
  if (val) return val;

  // 2. Try process.env (CRA / Node standard)
  try {
    if (typeof process !== 'undefined' && process.env) {
       val = process.env[key] || process.env[`REACT_APP_${key}`] || process.env[`VITE_${key}`];
    }
  } catch { /* Ignore errors accessing process.env */ }

  return val;
};
