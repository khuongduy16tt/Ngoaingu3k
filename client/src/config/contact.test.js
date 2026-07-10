import { describe, it, expect } from 'vitest';
import { contact } from './contact';

describe('contact config', () => {
  it('has required contact fields', () => {
    expect(contact.phone).toBeTruthy();
    expect(contact.email).toContain('@');
    expect(contact.zaloUrl).toContain('zalo.me');
    expect(contact.messengerUrl).toContain('m.me');
    expect(contact.companyName).toBe('Ngoaingu3k Academy');
  });

  it('has valid URLs', () => {
    expect(contact.zaloUrl).toMatch(/^https:\/\//);
    expect(contact.messengerUrl).toMatch(/^https:\/\//);
    expect(contact.siteUrl).toMatch(/^https:\/\//);
  });

  it('generates copyright with current year', () => {
    const year = new Date().getFullYear();
    expect(contact.copyright).toContain(String(year));
  });
});
