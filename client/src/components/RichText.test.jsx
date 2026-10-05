import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { RichText } from './RichText';

describe('RichText', () => {
  it('hiển thị <b> và <u> thành chữ đậm / gạch chân', () => {
    const { container } = render(<RichText text="c<b>a</b>t và mo<u>th</u>er" />);
    expect(container.querySelector('strong').textContent).toBe('a');
    expect(container.querySelector('u').textContent).toBe('th');
    expect(container.textContent).toBe('cat và mother');
  });

  it('không chèn HTML lạ: thẻ khác hiện nguyên văn', () => {
    const { container } = render(<RichText text={'<img src=x onerror=alert(1)> hello'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('biến link http(s) thành thẻ a mở tab mới, không ăn dấu câu cuối', () => {
    const { container } = render(<RichText text="Link nghe: https://youtu.be/abc123." />);
    const link = container.querySelector('a');
    expect(link.getAttribute('href')).toBe('https://youtu.be/abc123');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('văn bản rỗng không render gì', () => {
    const { container } = render(<RichText text="" />);
    expect(container.innerHTML).toBe('');
  });
});
