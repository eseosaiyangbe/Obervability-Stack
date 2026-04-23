// Site configuration for the DevOps Easy Learning control plane.
import { SiteConfig } from './types';

const legacySiteNames = new Set([
  'Monitoring in a Box',
  'DevOps Monitor',
]);

function isLegacySiteName(value?: string | null) {
  return typeof value === 'string' && legacySiteNames.has(value.trim());
}

function sanitizeLoadedConfig(config: SiteConfig): SiteConfig {
  const sanitized = { ...config };

  if (isLegacySiteName(sanitized.name)) {
    sanitized.name = DEFAULT_SITE_CONFIG.name;
  }

  if (isLegacySiteName(sanitized.company?.name)) {
    sanitized.company = {
      ...sanitized.company,
      name: DEFAULT_SITE_CONFIG.company.name,
    };
  }

  if (sanitized.seo?.title?.includes('Monitoring in a Box')) {
    sanitized.seo = {
      ...sanitized.seo,
      title: DEFAULT_SITE_CONFIG.seo.title,
      description: DEFAULT_SITE_CONFIG.seo.description,
      author: DEFAULT_SITE_CONFIG.seo.author,
      canonical: DEFAULT_SITE_CONFIG.seo.canonical,
      og: { ...DEFAULT_SITE_CONFIG.seo.og },
      twitter: { ...DEFAULT_SITE_CONFIG.seo.twitter },
    };
  }

  if (sanitized.contact?.email?.includes('monitoringinabox')) {
    sanitized.contact = {
      ...sanitized.contact,
      email: DEFAULT_SITE_CONFIG.contact.email,
      social: { ...DEFAULT_SITE_CONFIG.contact.social },
    };
  }

  if (sanitized.legal?.copyright?.includes('Monitoring in a Box')) {
    sanitized.legal = {
      ...sanitized.legal,
      copyright: DEFAULT_SITE_CONFIG.legal.copyright,
    };
  }

  return sanitized;
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  // Basic Site Information
  name: 'DevOps Easy Learning',
  description: 'Control plane for the DevOps Easy Learning portfolio with real-time metrics, logs, alerts, and operator guidance.',
  url: 'http://localhost:4000',
  version: '1.0.0',
  
  // SEO Configuration
  seo: {
    title: 'DevOps Easy Learning Control Plane',
    description: 'Unified control plane for OpenSIS, SwiftPay, FoodPulse, and MemFlip with monitoring, logging, alerts, and operator guidance.',
    keywords: [
      'devops easy learning',
      'control plane',
      'application monitoring',
      'prometheus',
      'grafana',
      'loki',
      'alertmanager',
      'observability',
      'incident response',
      'operator guide'
    ],
    author: 'DevOps Easy Learning Team',
    robots: 'index, follow',
    canonical: 'http://localhost:4000',
    og: {
      title: 'DevOps Easy Learning Control Plane',
      description: 'Unified control plane for app demos, observability, incident response, and operator handoff.',
      type: 'website',
      image: '/banner.png',
      url: 'http://localhost:4000',
      site_name: 'DevOps Easy Learning'
    },
    twitter: {
      card: 'summary_large_image',
      site: '@devopseasylearn',
      creator: '@devopseasylearn',
      title: 'DevOps Easy Learning Control Plane',
      description: 'Unified control plane for app demos, observability, and operator readiness.',
      image: '/banner.png'
    }
  },
  
  // Branding Configuration
  branding: {
    logo: {
      light: '/logo-light.png',
      dark: '/logo-dark.png',
      favicon: '/favicon.ico',
      apple_touch_icon: '/apple-touch-icon.png'
    },
    colors: {
      primary: '#3b82f6',
      secondary: '#10b981',
      accent: '#f59e0b',
      background: '#ffffff',
      surface: '#f8fafc'
    },
    fonts: {
      primary: 'Inter',
      secondary: 'system-ui, sans-serif'
    }
  },
  
  // Contact Information
  contact: {
    email: 'support@devopseasylearning.local',
    phone: '+1 (000) 000-0000',
    address: 'DevOps Easy Learning Lab',
    social: {
      twitter: 'https://twitter.com/devopseasylearn',
      linkedin: 'https://linkedin.com/company/devops-easy-learning',
      github: 'https://github.com/eseosaiyangbe/DevOps-Easy-Learning'
    }
  },
  
  // Company Information
  company: {
    name: 'DevOps Easy Learning',
    description: 'Hands-on portfolio environment for operating mixed-architecture workloads through one control plane.',
    founded: '2026',
    location: 'Toronto, ON'
  },
  
  // Legal Information
  legal: {
    privacy_policy_url: '/privacy-policy',
    terms_of_service_url: '/terms-of-service',
    cookie_policy_url: '/cookie-policy',
    copyright: '© 2026 DevOps Easy Learning. All rights reserved.'
  },
  
  // Feature Flags
  features: {
    analytics: true,
    notifications: true,
    multi_tenant: true,
    plugins: true,
    api_docs: true
  }
};

// Site Configuration Manager
export class SiteConfigManager {
  private static instance: SiteConfigManager;
  private config: SiteConfig;
  private listeners: Array<(config: SiteConfig) => void> = [];

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): SiteConfigManager {
    if (!SiteConfigManager.instance) {
      SiteConfigManager.instance = new SiteConfigManager();
    }
    return SiteConfigManager.instance;
  }

  public getConfig(): SiteConfig {
    return this.config;
  }

  public updateConfig(updates: Partial<SiteConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    this.notifyListeners();
  }

  public getSEOConfig() {
    return this.config.seo;
  }

  public getBrandingConfig() {
    return this.config.branding;
  }

  public getContactConfig() {
    return this.config.contact;
  }

  public getCompanyConfig() {
    return this.config.company;
  }

  public getLegalConfig() {
    return this.config.legal;
  }

  public getFeatureFlags() {
    return this.config.features;
  }

  public isFeatureEnabled(feature: keyof SiteConfig['features']): boolean {
    return this.config.features[feature];
  }

  public addListener(callback: (config: SiteConfig) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.config));
  }

  private loadConfig(): SiteConfig {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('site-config');
        if (stored) {
          const parsed = JSON.parse(stored);
          return sanitizeLoadedConfig({ ...DEFAULT_SITE_CONFIG, ...parsed });
        }
      } catch (error) {
        console.warn('Failed to load site config from localStorage:', error);
      }
    }
    return sanitizeLoadedConfig(DEFAULT_SITE_CONFIG);
  }

  private saveConfig(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('site-config', JSON.stringify(this.config));
      } catch (error) {
        console.warn('Failed to save site config to localStorage:', error);
      }
    }
  }
}

// Export singleton instance
export const siteConfigManager = SiteConfigManager.getInstance();
