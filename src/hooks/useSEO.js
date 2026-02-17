import { useEffect } from 'react';

const SITE_NAME = 'Training Track';
const BASE_URL = 'https://trainingtrack.es';
const DEFAULT_IMAGE = `${BASE_URL}/img/og-image.png`;

/**
 * Hook to set dynamic meta tags for SEO.
 * Manages title, description, Open Graph, Twitter Card, canonical URL,
 * and JSON-LD structured data.
 *
 * @param {Object} options
 * @param {string} options.title - Page title (appended with site name)
 * @param {string} options.description - Meta description (150-160 chars ideal)
 * @param {string} [options.path] - URL path for canonical (e.g. '/blog')
 * @param {string} [options.image] - OG/Twitter image URL
 * @param {string} [options.type] - OG type (default 'website')
 * @param {Object} [options.schema] - JSON-LD structured data object
 */
export default function useSEO({ title, description, path, image, type = 'website', schema }) {
  useEffect(() => {
    // Title
    document.title = title ? `${title} | ${SITE_NAME}` : SITE_NAME;

    // Helper to set/create meta tags
    const setMeta = (attr, key, content) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // Description
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
      setMeta('name', 'twitter:description', description);
    }

    // Open Graph
    if (title) {
      setMeta('property', 'og:title', title);
      setMeta('name', 'twitter:title', title);
    }
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:image', image || DEFAULT_IMAGE);
    setMeta('name', 'twitter:image', image || DEFAULT_IMAGE);
    setMeta('name', 'twitter:card', 'summary_large_image');

    if (path) {
      setMeta('property', 'og:url', `${BASE_URL}${path}`);
    }

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', path ? `${BASE_URL}${path}` : BASE_URL);

    // JSON-LD
    let scriptTag = document.querySelector('script[data-seo="dynamic"]');
    if (schema) {
      if (!scriptTag) {
        scriptTag = document.createElement('script');
        scriptTag.setAttribute('type', 'application/ld+json');
        scriptTag.setAttribute('data-seo', 'dynamic');
        document.head.appendChild(scriptTag);
      }
      scriptTag.textContent = JSON.stringify(schema);
    }

    // Cleanup
    return () => {
      if (scriptTag) scriptTag.remove();
    };
  }, [title, description, path, image, type, schema]);
}
