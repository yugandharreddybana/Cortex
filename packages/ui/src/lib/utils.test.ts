import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('merges basic string class names', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('handles conditional classes', () => {
    expect(cn('base', { 'is-active': true, 'is-inactive': false })).toBe('base is-active');
  });

  it('filters out falsy values', () => {
    expect(cn('base', null, undefined, false, 0, '')).toBe('base');
  });

  it('handles arrays of class names', () => {
    expect(cn(['class1', 'class2'], 'class3')).toBe('class1 class2 class3');
  });

  it('resolves Tailwind CSS conflicts correctly', () => {
    // p-4 should override p-2
    expect(cn('p-2', 'p-4')).toBe('p-4');

    // mt-4 should override my-2's top margin, but mb-2 (from my-2) remains
    expect(cn('my-2', 'mt-4')).toBe('my-2 mt-4');

    // text-white should override text-black
    expect(cn('text-black', 'text-white')).toBe('text-white');
  });

  it('works with complex combinations of objects, arrays, and tailwind merges', () => {
    expect(
      cn(
        'p-2 text-black',
        ['m-2', 'bg-red-500'],
        { 'p-4 text-white': true, 'bg-blue-500': false },
        'm-4'
      )
    ).toBe('bg-red-500 p-4 text-white m-4');
  });
});
