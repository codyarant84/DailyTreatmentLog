import { useEffect } from 'react';

// This app is a client-rendered Vite SPA with no server-side rendering, so
// these tags land in the DOM after mount rather than in the initial HTML
// response. That's sufficient for crawlers that execute JavaScript (Google,
// most modern indexers) but NOT for simple fetch-only crawlers or some AI
// scrapers that read raw HTML. True SSR/prerendering would be needed to
// close that gap — out of scope here, flagging it as a known limitation.

const SITE_NAME = 'Fieldside Health';
const DEFAULT_IMAGE = 'https://fieldsidehealth.com/og-image.png';

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function SeoHead({ title, description, path, image }) {
  useEffect(() => {
    const prevTitle = document.title;
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    document.title = fullTitle;

    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:image', image || DEFAULT_IMAGE);
    if (path) upsertMeta('property', 'og:url', `https://fieldsidehealth.com${path}`);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', description);

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, path, image]);

  return null;
}
