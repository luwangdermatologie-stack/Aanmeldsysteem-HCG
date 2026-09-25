/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppEnvironment = 'test' | 'production';

const STORAGE_KEY_ENV_OVERRIDE = 'hcg_environment_override';

/**
 * Detects whether the app is currently running in the Google AI Studio test environment
 * or in the active GitHub production environment.
 */
export function getDetectedEnvironment(): AppEnvironment {
  // 1. Check if the administrator manually selected an override in localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ENV_OVERRIDE);
      if (stored === 'test' || stored === 'production') {
        return stored;
      }
    } catch {
      // Ignore storage errors (private browsing, iframe sandbox, etc.)
    }
  }

  // 2. Check build-time or runtime environment variable from Vite / CI/CD
  const envVar = (import.meta as any).env?.VITE_APP_ENV;
  if (envVar === 'production' || envVar === 'prod') {
    return 'production';
  }
  if (envVar === 'test' || envVar === 'dev') {
    return 'test';
  }

  // 3. Dynamic browser hostname detection
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname.toLowerCase();

    // Active GitHub environment (GitHub Pages deployment: *.github.io)
    if (hostname.endsWith('.github.io') || hostname.includes('github.io')) {
      return 'production';
    }

    // Google AI Studio preview & development containers:
    // - Cloud Run preview URLs: ais-dev-*.run.app, ais-pre-*.run.app
    // - AI Studio domains: *.ai.studio, *.google.com, *.aistudio.google.com
    // - Local development: localhost, 127.0.0.1
    if (
      hostname.includes('run.app') ||
      hostname.includes('ai.studio') ||
      hostname.includes('google') ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1'
    ) {
      return 'test';
    }
  }

  // Safe default: use test environment to prevent accidental pollution of production
  return 'test';
}

/**
 * Get the natural environment without any manual override applied
 */
export function getNaturalEnvironment(): AppEnvironment {
  const envVar = (import.meta as any).env?.VITE_APP_ENV;
  if (envVar === 'production' || envVar === 'prod') {
    return 'production';
  }
  if (envVar === 'test' || envVar === 'dev') {
    return 'test';
  }

  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.endsWith('.github.io') || hostname.includes('github.io')) {
      return 'production';
    }
  }

  return 'test';
}

/**
 * Returns whether a manual override is active
 */
export function hasEnvironmentOverride(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const val = localStorage.getItem(STORAGE_KEY_ENV_OVERRIDE);
    return val === 'test' || val === 'production';
  } catch {
    return false;
  }
}

/**
 * Set or clear an administrator environment override
 */
export function setEnvironmentOverride(env: AppEnvironment | null) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (env === null) {
      localStorage.removeItem(STORAGE_KEY_ENV_OVERRIDE);
    } else {
      localStorage.setItem(STORAGE_KEY_ENV_OVERRIDE, env);
    }
    // Dispatch custom event so reactive components can update instantly
    window.dispatchEvent(new CustomEvent('hcg_environment_changed', { detail: { environment: env || getNaturalEnvironment() } }));
  } catch (err) {
    console.error('Failed to set environment override:', err);
  }
}

/**
 * Resolves the Firestore collection name for the active environment.
 * 
 * - In 'production' (active GitHub deployment):
 *   Uses the standard collection names (e.g. 'patients', 'doctors', 'staff')
 * 
 * - In 'test' (Google AI Studio environment):
 *   Uses 'test_' prefixed collection names (e.g. 'test_patients', 'test_doctors', 'test_staff')
 */
export function getEnvCollectionName(baseCollection: string, targetEnv?: AppEnvironment): string {
  const env = targetEnv || getDetectedEnvironment();
  if (env === 'test') {
    return `test_${baseCollection}`;
  }
  return baseCollection;
}

export function isTestEnvironment(): boolean {
  return getDetectedEnvironment() === 'test';
}

export function isProductionEnvironment(): boolean {
  return getDetectedEnvironment() === 'production';
}
