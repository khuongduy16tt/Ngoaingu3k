import React from 'react';

const LOGO_DIR = '/images/imported/';

/** Exact original lockup: `white` for brand-colored surfaces, `color` for light surfaces. */
export function BrandLogo({ className = '', variant = 'white' }) {
  const classes = `brand-logo ${className}`.trim();
  return (
    <span className={classes}>
      <img className="brand-logo__image" src={`${LOGO_DIR}logo-ngoaingu3k-${variant}-transparent-sm.webp`} alt="ngoaingu3k" />
    </span>
  );
}
