// The things a site needs before it is launched or sold from: the policy pages a visitor and a
// regulator look for, working forms, spam protection, analytics, and an honest account of which
// third parties the page loads.
//
// Same split as the design area: the in-page script only measures, and every judgement is a pure
// function below. Legal items that need a human (dark patterns, hidden fees, unsupported claims,
// fake reviews, licensing) are deliberately absent — a deterministic checker cannot rule on them.

/** Raw per-page measurements. Shapes only; no judgement. */
export interface EssentialsRaw {
  links: { href: string; text: string }[];
  forms: FormRaw[];
  thirdParty: string[];          // origins of scripts, iframes and beacons that are not this site
  analytics: string[];           // analytics vendors detected by script URL or global
  cookieBanner: boolean;
  ctas: { text: string; href: string }[];   // prominent actions in the first screen
  focusSuppressed: number;       // `outline: none` on :focus with no :focus-visible replacement
  clickableNonButtons: number;   // div/span wired to click with no role, tabindex or key handler
  contact: { email: boolean; phone: boolean; address: boolean; company: boolean };
}

export interface FormRaw {
  action: string;
  method: string;
  fields: number;
  required: number;
  emailTyped: number;            // <input type="email">, which validates for free
  labelled: number;              // controls with a label, aria-label or aria-labelledby
  novalidate: boolean;
  consentCheckbox: boolean;      // a checkbox next to the submit, for marketing or terms
  captcha: boolean;
  honeypot: boolean;             // a hidden field used to catch bots
  inlineSubmitHandler: boolean;  // an onsubmit attribute, which proves something handles it
}

/**
 * Runs in the rendered page. Plain JavaScript source so no transpiler helpers leak in.
 * Signature: () => EssentialsRaw
 */
export const ESSENTIALS_SCRIPT = String.raw`() => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const origin = location.origin;
  const out = {
    links: [], forms: [], thirdParty: [], analytics: [], cookieBanner: false, ctas: [],
    focusSuppressed: 0, clickableNonButtons: 0,
    contact: { email: false, phone: false, address: false, company: false },
  };

  const seenLink = new Set();
  for (const a of Array.from(document.querySelectorAll('a[href]')).slice(0, 600)) {
    const href = a.href || '';
    const text = norm(a.textContent).slice(0, 80);
    const key = href + '|' + text;
    if (seenLink.has(key)) continue;
    seenLink.add(key);
    out.links.push({ href: href, text: text });
  }

  for (const f of Array.from(document.querySelectorAll('form')).slice(0, 20)) {
    const controls = Array.from(f.querySelectorAll('input,select,textarea'));
    const visible = controls.filter((c) => c.type !== 'hidden');
    const labelled = visible.filter((c) => {
      if (c.getAttribute('aria-label') || c.getAttribute('aria-labelledby')) return true;
      if (c.id && f.querySelector('label[for="' + CSS.escape(c.id) + '"]')) return true;
      return !!c.closest('label');
    });
    const hidden = controls.filter((c) => {
      if (c.type === 'hidden') return false;
      const st = getComputedStyle(c);
      return st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) === 0;
    });
    const html = f.innerHTML || '';
    out.forms.push({
      action: f.getAttribute('action') || '',
      method: (f.getAttribute('method') || 'get').toLowerCase(),
      fields: visible.length,
      required: visible.filter((c) => c.hasAttribute('required') || c.getAttribute('aria-required') === 'true').length,
      emailTyped: visible.filter((c) => c.type === 'email').length,
      labelled: labelled.length,
      novalidate: f.hasAttribute('novalidate'),
      consentCheckbox: visible.some((c) => c.type === 'checkbox'),
      captcha: /recaptcha|hcaptcha|turnstile|friendly-?challenge/i.test(html) || !!document.querySelector('script[src*="recaptcha"],script[src*="hcaptcha"],script[src*="turnstile"]'),
      honeypot: hidden.length > 0,
      inlineSubmitHandler: f.hasAttribute('onsubmit') || Array.from(f.querySelectorAll('button,input[type="submit"]')).some((b) => b.hasAttribute('onclick')),
    });
  }

  const thirdParty = new Set();
  const addOrigin = (u) => {
    if (!u) return;
    try { const o = new URL(u, origin).origin; if (o !== origin && /^https?:/.test(o)) thirdParty.add(o); } catch (e) { /* ignore */ }
  };
  for (const s of Array.from(document.querySelectorAll('script[src]')).slice(0, 200)) addOrigin(s.getAttribute('src'));
  for (const i of Array.from(document.querySelectorAll('iframe[src]')).slice(0, 60)) addOrigin(i.getAttribute('src'));
  for (const l of Array.from(document.querySelectorAll('link[href][rel="stylesheet"],link[rel="preconnect"]')).slice(0, 60)) addOrigin(l.getAttribute('href'));
  out.thirdParty = Array.from(thirdParty).slice(0, 40);

  const scriptSrc = Array.from(document.querySelectorAll('script[src]')).map((s) => s.getAttribute('src') || '').join(' ');
  const VENDORS = [
    ['Google Analytics', /googletagmanager\.com\/gtag|google-analytics\.com|\bgtag\(/],
    ['Google Tag Manager', /googletagmanager\.com\/gtm/],
    ['Plausible', /plausible\.io/],
    ['Fathom', /usefathom\.com/],
    ['PostHog', /posthog\.com|posthog\.js/],
    ['Umami', /umami\./],
    ['Vercel Analytics', /\/_vercel\/insights/],
    ['Matomo', /matomo|piwik/],
    ['Simple Analytics', /simpleanalytics/],
    ['Cloudflare Web Analytics', /static\.cloudflareinsights\.com/],
  ];
  const inline = Array.from(document.querySelectorAll('script:not([src])')).map((s) => (s.textContent || '').slice(0, 2000)).join(' ');
  for (const v of VENDORS) if (v[1].test(scriptSrc) || v[1].test(inline)) out.analytics.push(v[0]);
  if (window.dataLayer && out.analytics.indexOf('Google Tag Manager') === -1) out.analytics.push('Google Tag Manager');

  // cookie banner: a known platform, or a fixed bar whose text is about cookies
  if (/cookiebot|onetrust|cookieyes|termly|iubenda|klaro|osano|cookieconsent|usercentrics/i.test(scriptSrc + ' ' + document.documentElement.className)) out.cookieBanner = true;
  if (!out.cookieBanner) {
    for (const el of Array.from(document.querySelectorAll('div,section,aside,dialog')).slice(0, 1200)) {
      let st; try { st = getComputedStyle(el); } catch (e) { continue; }
      if (st.position !== 'fixed' && st.position !== 'sticky') continue;
      const t = norm(el.textContent).slice(0, 400);
      if (/cookie|consent/i.test(t) && /accept|agree|allow|reject|decline|manage|preferences/i.test(t)) { out.cookieBanner = true; break; }
    }
  }

  // calls to action in the first screen
  const fold = window.innerHeight || 800;
  for (const el of Array.from(document.querySelectorAll('a[href],button')).slice(0, 300)) {
    let rect; try { rect = el.getBoundingClientRect(); } catch (e) { continue; }
    if (rect.top >= fold || rect.width < 60 || rect.height < 28) continue;
    const text = norm(el.textContent).slice(0, 60);
    if (!text) continue;
    if (el.closest('nav,header')) continue;
    out.ctas.push({ text: text, href: el.getAttribute('href') || '' });
  }

  for (const el of Array.from(document.querySelectorAll('div,span,li')).slice(0, 1500)) {
    if (!el.hasAttribute('onclick')) continue;
    if (el.getAttribute('role') === 'button' || el.hasAttribute('tabindex')) continue;
    out.clickableNonButtons++;
  }

  let css = '';
  for (const sheet of Array.from(document.styleSheets)) {
    let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
    if (!rules) continue;
    for (const rule of Array.from(rules).slice(0, 4000)) css += (rule.cssText || '').slice(0, 300);
  }
  const focusNone = (css.match(/:focus(?!-visible)[^{]*\{[^}]*outline\s*:\s*(?:none|0)/g) || []).length;
  const focusVisible = /:focus-visible[^{]*\{[^}]*outline/.test(css) ? 1 : 0;
  out.focusSuppressed = focusVisible ? 0 : focusNone;

  const foot = document.querySelector('footer') || document.body;
  const footText = norm(foot ? foot.textContent : '').slice(0, 4000);
  out.contact.email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(footText) || !!document.querySelector('a[href^="mailto:"]');
  out.contact.phone = /\+?\d[\d ()-]{7,}\d/.test(footText) || !!document.querySelector('a[href^="tel:"]');
  out.contact.address = /\b\d{1,5}\s+[A-Z][A-Za-z.]+\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Lane|Ln|Way|Drive|Dr|Suite|Ste)\b/.test(footText)
    || /\b[A-Z]{2}\s+\d{5}\b|\b\d{4,6}\s+[A-Z][a-z]+\b/.test(footText);
  out.contact.company = /\b(?:Ltd|Limited|LLC|L\.L\.C\.|Inc\.?|Incorporated|GmbH|Pty|B\.V\.|S\.A\.|Pvt|Private Limited|LLP)\b/.test(footText)
    || /©|\bcopyright\b/i.test(footText);
  return out;
}`;

// ── pure analysis ───────────────────────────────────────────────────────────

export interface PolicySpec { id: string; label: string; re: RegExp }

/** The pages a visitor, an app store and a data-protection regulator all look for. */
export const POLICIES: PolicySpec[] = [
  { id: 'privacy', label: 'Privacy policy', re: /privacy|datenschutz|gizlilik/i },
  { id: 'terms', label: 'Terms of service', re: /\bterms\b|\btos\b|conditions|nutzungsbedingungen/i },
  { id: 'cookies', label: 'Cookie policy', re: /cookie/i },
  { id: 'refund', label: 'Refund or returns policy', re: /refund|returns?\b|cancellation|money.?back/i },
  { id: 'deletion', label: 'Data deletion route', re: /data.?deletion|delete.?(?:your.)?account|erase.?my.?data|dsar|subject.?access/i },
];

/** A policy counts as present when a link's path or its visible text names it. */
export function findPolicies(links: { href: string; text: string }[]): Record<string, string | undefined> {
  const found: Record<string, string | undefined> = {};
  for (const p of POLICIES) {
    const hit = links.find(l => {
      let path = '';
      try { path = new URL(l.href).pathname; } catch { path = l.href; }
      return p.re.test(path) || p.re.test(l.text);
    });
    found[p.id] = hit?.href;
  }
  return found;
}

/** Signals that the site takes money, which is what makes a refund policy expected. */
export function looksCommercial(text: string, links: { href: string; text: string }[]): boolean {
  if (/\b(?:add to (?:cart|basket)|checkout|buy now|subscribe|start (?:free )?trial|per month|\/mo\b|billed annually)\b/i.test(text)) return true;
  return links.some(l => /\/(?:checkout|cart|pricing|plans|subscribe|billing)\b/i.test(l.href));
}

/** Known third-party origins worth naming in a privacy notice, grouped by what they do. */
export const TRACKER_KINDS: [RegExp, string][] = [
  [/googletagmanager|google-analytics|analytics\.google/i, 'analytics'],
  [/doubleclick|googlesyndication|googleadservices/i, 'advertising'],
  [/facebook\.net|connect\.facebook|facebook\.com\/tr/i, 'advertising'],
  [/hotjar|clarity\.ms|fullstory|logrocket|smartlook/i, 'session recording'],
  [/segment\.(?:io|com)|rudderstack|mixpanel|amplitude|posthog/i, 'product analytics'],
  [/intercom|drift\.com|crisp\.chat|tawk\.to|hubspot/i, 'chat and CRM'],
  [/sentry|bugsnag|rollbar|datadoghq/i, 'error monitoring'],
  [/stripe|paypal|paddle|lemonsqueezy/i, 'payments'],
  [/fonts\.googleapis|fonts\.gstatic/i, 'fonts'],
];

export function classifyThirdParty(origins: string[]): { origin: string; kind: string }[] {
  const out: { origin: string; kind: string }[] = [];
  for (const o of origins) {
    const hit = TRACKER_KINDS.find(([re]) => re.test(o));
    out.push({ origin: o, kind: hit ? hit[1] : 'other' });
  }
  return out;
}

/** Third parties that set identifiers or record behaviour, which a cookie banner is meant to gate. */
export function trackingThirdParty(origins: string[]): { origin: string; kind: string }[] {
  const gated = new Set(['analytics', 'advertising', 'session recording', 'product analytics', 'chat and CRM']);
  return classifyThirdParty(origins).filter(t => gated.has(t.kind));
}

export interface FormProblem { kind: string; detail: string }

/** Forms that cannot work, or that will fill with spam. */
export function formProblems(forms: FormRaw[]): FormProblem[] {
  const out: FormProblem[] = [];
  for (const f of forms) {
    if (f.fields === 0) continue;
    if (!f.action && !f.inlineSubmitHandler) out.push({ kind: 'unverifiable-submit', detail: `A form with ${f.fields} field${f.fields === 1 ? '' : 's'} has no action attribute and no inline handler, so nothing in the page shows where a submission goes.` });
    if (f.novalidate && f.required === 0) out.push({ kind: 'no-validation', detail: `A form with ${f.fields} fields sets novalidate and marks nothing required.` });
    else if (f.required === 0) out.push({ kind: 'no-required', detail: `None of the ${f.fields} fields on a form is required, so an empty submission is accepted.` });
    if (f.labelled < f.fields) out.push({ kind: 'unlabelled', detail: `${f.fields - f.labelled} of ${f.fields} form controls have no label, so a screen reader announces them as unnamed.` });
    if (!f.captcha && !f.honeypot && f.fields >= 2) out.push({ kind: 'no-spam-protection', detail: `A form with ${f.fields} fields has neither a captcha nor a honeypot field.` });
  }
  return out;
}

/** A 404 that returns the right status but shows nothing a visitor can use. */
export function unhelpful404(status: number, title: string, words: number, links: number): boolean {
  return status === 404 && (words < 15 || links === 0 || /^(?:not found|404)\.?$/i.test(title.trim()));
}
