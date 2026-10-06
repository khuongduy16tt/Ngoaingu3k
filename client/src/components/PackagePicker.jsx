import React, { useId } from 'react';
import { formatVnd } from '../lib/money';

export function PackagePicker({ price, tutoringPrice, withTutoring, onChange, courseLabel = 'Chỉ khóa học' }) {
  const name = useId();

  if (!tutoringPrice) {
    return null;
  }

  const options = [
    { value: false, label: courseLabel, amount: price },
    { value: true, label: 'Kèm dạy kèm', amount: tutoringPrice }
  ];

  return (
    <fieldset className="package-picker" aria-label="Chọn gói">
      {options.map((option) => (
        <label key={String(option.value)} className={`package-picker__option ${withTutoring === option.value ? 'is-active' : ''}`}>
          <input
            type="radio"
            name={name}
            checked={withTutoring === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
          <strong>{formatVnd(option.amount)}</strong>
        </label>
      ))}
    </fieldset>
  );
}
