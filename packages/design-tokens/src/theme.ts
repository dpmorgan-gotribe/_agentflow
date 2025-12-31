/**
 * Theme Manager
 *
 * Manages theme variants and runtime theme switching.
 * Provides a singleton pattern for consistent theme state.
 *
 * Note: Browser-specific features (matchMedia, document) are only used
 * when available. This module works in both Node.js and browser contexts.
 */

import type { SemanticColors, ThemeMode, ColorScale } from './schema.js';
import { DEFAULT_LIGHT_COLORS, DEFAULT_DARK_COLORS } from './defaults.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Theme configuration
 */
export interface ThemeConfig {
  name: string;
  mode: ThemeMode;
  colors: SemanticColors;
}

/**
 * Theme change event detail
 */
export interface ThemeChangeEvent {
  theme: string;
  mode: ThemeMode;
  isAuto: boolean;
}

/**
 * Theme change listener
 */
export type ThemeChangeListener = (event: ThemeChangeEvent) => void;

// ============================================================================
// Theme Manager
// ============================================================================

/**
 * Theme manager class
 */
export class ThemeManager {
  private themes: Map<string, ThemeConfig> = new Map();
  private currentTheme: string = 'light';
  private systemPreference: 'light' | 'dark' = 'light';
  private listeners: Set<ThemeChangeListener> = new Set();
  private mediaQueryCleanup: (() => void) | null = null;

  constructor() {
    // Register default themes
    this.registerTheme({
      name: 'light',
      mode: 'light',
      colors: DEFAULT_LIGHT_COLORS,
    });

    this.registerTheme({
      name: 'dark',
      mode: 'dark',
      colors: DEFAULT_DARK_COLORS,
    });

    // Detect system preference (browser only)
    this.initSystemPreference();
  }

  /**
   * Initialize system preference detection
   */
  private initSystemPreference(): void {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    try {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemPreference = darkModeQuery.matches ? 'dark' : 'light';

      // Listen for changes
      const handler = (e: MediaQueryListEvent) => {
        this.systemPreference = e.matches ? 'dark' : 'light';
        if (this.currentTheme === 'auto') {
          this.notifyListeners();
          this.applyTheme('auto');
        }
      };

      darkModeQuery.addEventListener('change', handler);
      this.mediaQueryCleanup = () => {
        darkModeQuery.removeEventListener('change', handler);
      };
    } catch {
      // Media query not supported
    }
  }

  /**
   * Register a custom theme
   */
  registerTheme(config: ThemeConfig): void {
    if (!config.name || config.name.length > 50) {
      throw new Error('Theme name must be 1-50 characters');
    }
    this.themes.set(config.name, config);
  }

  /**
   * Unregister a theme
   */
  unregisterTheme(name: string): boolean {
    if (name === 'light' || name === 'dark') {
      throw new Error('Cannot unregister built-in themes');
    }
    if (this.currentTheme === name) {
      this.setTheme('light');
    }
    return this.themes.delete(name);
  }

  /**
   * Get all registered theme names
   */
  getThemeNames(): string[] {
    return Array.from(this.themes.keys());
  }

  /**
   * Get a theme by name
   */
  getTheme(name: string): ThemeConfig | undefined {
    return this.themes.get(name);
  }

  /**
   * Check if theme exists
   */
  hasTheme(name: string): boolean {
    return this.themes.has(name);
  }

  /**
   * Get current theme name
   */
  getCurrentTheme(): string {
    return this.currentTheme;
  }

  /**
   * Get system preference
   */
  getSystemPreference(): 'light' | 'dark' {
    return this.systemPreference;
  }

  /**
   * Get effective theme (resolves 'auto')
   */
  getEffectiveTheme(): ThemeConfig {
    if (this.currentTheme === 'auto') {
      const theme = this.themes.get(this.systemPreference);
      if (theme) return theme;
    }

    const theme = this.themes.get(this.currentTheme);
    if (theme) return theme;

    // Fallback to light
    return this.themes.get('light')!;
  }

  /**
   * Get effective theme mode
   */
  getEffectiveMode(): 'light' | 'dark' {
    const theme = this.getEffectiveTheme();
    return theme.mode === 'auto' ? this.systemPreference : theme.mode;
  }

  /**
   * Set the current theme
   */
  setTheme(name: string | 'auto'): void {
    if (name !== 'auto' && !this.themes.has(name)) {
      throw new Error(`Theme not found: ${name}`);
    }
    this.currentTheme = name;
    this.applyTheme(name);
    this.notifyListeners();
  }

  /**
   * Apply theme to document
   */
  private applyTheme(name: string | 'auto'): void {
    if (typeof document === 'undefined') return;

    const effectiveTheme = name === 'auto' ? this.systemPreference : name;

    // Set data attribute for CSS targeting
    document.documentElement.setAttribute('data-theme', effectiveTheme);

    // Emit custom DOM event
    try {
      const event = new CustomEvent('themechange', {
        detail: {
          theme: effectiveTheme,
          mode: this.getEffectiveMode(),
          isAuto: name === 'auto',
        },
      });
      document.dispatchEvent(event);
    } catch {
      // CustomEvent not supported
    }
  }

  /**
   * Toggle between light and dark
   */
  toggle(): void {
    const effective = this.getEffectiveTheme();
    const newTheme = effective.mode === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * Add theme change listener
   */
  addListener(listener: ThemeChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove theme change listener
   */
  removeListener(listener: ThemeChangeListener): boolean {
    return this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const event: ThemeChangeEvent = {
      theme: this.getEffectiveTheme().name,
      mode: this.getEffectiveMode(),
      isAuto: this.currentTheme === 'auto',
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Generate CSS variables for a specific theme
   */
  generateThemeCSS(themeName: string): string {
    const theme = this.themes.get(themeName);
    if (!theme) {
      throw new Error(`Theme not found: ${themeName}`);
    }

    const lines: string[] = [`[data-theme="${themeName}"] {`];

    // Color scales
    const scales = [
      'primary',
      'secondary',
      'accent',
      'success',
      'warning',
      'error',
      'info',
      'neutral',
    ] as const;

    for (const scale of scales) {
      const colorScale = theme.colors[scale] as ColorScale;
      for (const [shade, value] of Object.entries(colorScale)) {
        lines.push(`  --color-${scale}-${shade}: ${value};`);
      }
    }

    // Background colors
    for (const [name, value] of Object.entries(theme.colors.background)) {
      lines.push(`  --bg-${name}: ${value};`);
    }

    // Surface colors
    for (const [name, value] of Object.entries(theme.colors.surface)) {
      lines.push(`  --surface-${name}: ${value};`);
    }

    // Text colors
    for (const [name, value] of Object.entries(theme.colors.text)) {
      lines.push(`  --text-${name}: ${value};`);
    }

    // Border colors
    for (const [name, value] of Object.entries(theme.colors.border)) {
      lines.push(`  --border-${name}: ${value};`);
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Generate CSS for all registered themes
   */
  generateAllThemesCSS(): string {
    const cssBlocks: string[] = [];
    for (const themeName of this.themes.keys()) {
      cssBlocks.push(this.generateThemeCSS(themeName));
    }
    return cssBlocks.join('\n\n');
  }

  /**
   * Create a custom theme from base
   */
  createTheme(
    name: string,
    baseName: string,
    overrides: Partial<SemanticColors>
  ): ThemeConfig {
    const base = this.themes.get(baseName);
    if (!base) {
      throw new Error(`Base theme not found: ${baseName}`);
    }

    const newTheme: ThemeConfig = {
      name,
      mode: base.mode,
      colors: this.deepMergeColors(base.colors, overrides),
    };

    this.registerTheme(newTheme);
    return newTheme;
  }

  /**
   * Deep merge color objects
   */
  private deepMergeColors(
    target: SemanticColors,
    source: Partial<SemanticColors>
  ): SemanticColors {
    const result = { ...target };

    for (const key of Object.keys(source) as (keyof SemanticColors)[]) {
      const sourceValue = source[key];
      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue)
      ) {
        const targetValue = result[key];
        if (
          targetValue &&
          typeof targetValue === 'object' &&
          !Array.isArray(targetValue)
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (result as any)[key] = { ...targetValue, ...sourceValue };
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (result as any)[key] = sourceValue;
        }
      } else if (sourceValue !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result as any)[key] = sourceValue;
      }
    }

    return result;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.listeners.clear();
    if (this.mediaQueryCleanup) {
      this.mediaQueryCleanup();
      this.mediaQueryCleanup = null;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Global theme manager instance
 */
let globalThemeManager: ThemeManager | null = null;

/**
 * Get global theme manager
 */
export function getThemeManager(): ThemeManager {
  if (!globalThemeManager) {
    globalThemeManager = new ThemeManager();
  }
  return globalThemeManager;
}

/**
 * Reset global theme manager (for testing)
 */
export function resetThemeManager(): void {
  if (globalThemeManager) {
    globalThemeManager.destroy();
  }
  globalThemeManager = null;
}
