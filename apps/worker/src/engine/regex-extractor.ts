/**
 * Regex Extraction Engine
 *
 * This is the CORE of the hybrid approach — handles 90% of extraction work for $0.
 * Pure deterministic pattern matching: fast, free, reliable.
 */

export interface RegexExtractionResult {
  emails: string[];
  phones: string[];
  whatsapps: string[];
  websites: string[];
  socialMedia: Record<string, string>;
}

/**
 * Extract all contact info from raw HTML/text using regex patterns
 */
export function regexExtract(html: string): RegexExtractionResult {
  return {
    emails: extractEmails(html),
    phones: extractPhones(html),
    whatsapps: extractWhatsApp(html),
    websites: extractWebsites(html),
    socialMedia: extractSocialMedia(html),
  };
}

/**
 * Extract email addresses
 */
function extractEmails(text: string): string[] {
  const pattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(pattern) || [];
  // Filter out common false positives
  return [...new Set(matches)].filter(e =>
    !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.css') &&
    !e.endsWith('.js') && !e.includes('example.com') && !e.includes('sentry')
  );
}

/**
 * Extract phone numbers — supports international formats
 */
function extractPhones(text: string): string[] {
  const patterns = [
    /(?:\+?234|0)[789]\d{9}/g,                        // Nigerian
    /(?:\+?1)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, // US/Canada
    /(?:\+?44)[\s.-]?\d{4}[\s.-]?\d{6}/g,            // UK
    /(?:\+?\d{1,4}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, // Generic
  ];

  const phones = new Set<string>();
  for (const pattern of patterns) {
    const matches = text.match(pattern) || [];
    for (const m of matches) {
      const cleaned = m.replace(/[\s.-]/g, '').replace(/^\(/, '').replace(/\)/, '');
      if (cleaned.length >= 7 && cleaned.length <= 15) {
        phones.add(cleaned);
      }
    }
  }

  return [...phones];
}

/**
 * Extract WhatsApp links/numbers
 */
function extractWhatsApp(text: string): string[] {
  const patterns = [
    /wa\.me\/(\+?\d{7,15})/g,
    /whatsapp\.com\/send\?phone=(\+?\d{7,15})/g,
    /api\.whatsapp\.com\/send\?phone=(\+?\d{7,15})/g,
  ];

  const numbers = new Set<string>();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      numbers.add(match[1]!);
    }
  }

  return [...numbers];
}

/**
 * Extract website URLs
 */
function extractWebsites(text: string): string[] {
  const pattern = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/g;
  const matches = text.match(pattern) || [];
  return [...new Set(matches)].filter(url =>
    !url.includes('facebook.com') && !url.includes('twitter.com') &&
    !url.includes('instagram.com') && !url.includes('linkedin.com') &&
    !url.includes('googleapis.com') && !url.includes('gstatic.com') &&
    !url.endsWith('.css') && !url.endsWith('.js') && !url.endsWith('.png')
  ).slice(0, 5);
}

/**
 * Extract social media links
 */
function extractSocialMedia(text: string): Record<string, string> {
  const social: Record<string, string> = {};
  const patterns: [string, RegExp][] = [
    ['facebook', /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+/g],
    ['instagram', /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._-]+/g],
    ['twitter', /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[a-zA-Z0-9._-]+/g],
    ['linkedin', /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company)\/[a-zA-Z0-9._-]+/g],
    ['youtube', /https?:\/\/(?:www\.)?youtube\.com\/(?:c|channel|@)[a-zA-Z0-9._-]+/g],
    ['tiktok', /https?:\/\/(?:www\.)?tiktok\.com\/@[a-zA-Z0-9._-]+/g],
  ];

  for (const [name, pattern] of patterns) {
    const match = text.match(pattern);
    if (match) social[name] = match[0]!;
  }

  return social;
}