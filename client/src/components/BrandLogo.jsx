import React from 'react';

const LOGO_DIR = '/images/imported/';

/** Exact original lockup, with transparent variants for light and dark surfaces. */
export function BrandLogo({ className = '', variant = 'white' }) {
  const classes = `brand-logo ${className}`.trim();
  if (variant === 'theme') {
    return (
      <span className={classes}>
        <img className="brand-logo__image brand-logo__image--light" src={`${LOGO_DIR}logo-ngoaingu3k-color-transparent-sm.webp`} alt="ngoaingu3k" />
        <img className="brand-logo__image brand-logo__image--dark" src={`${LOGO_DIR}logo-ngoaingu3k-white-transparent-sm.webp`} alt="ngoaingu3k" />
      </span>
    );
  }

  return (
    <span className={classes}>
      <img className="brand-logo__image" src={`${LOGO_DIR}logo-ngoaingu3k-${variant}-transparent-sm.webp`} alt="ngoaingu3k" />
    </span>
  );
}
