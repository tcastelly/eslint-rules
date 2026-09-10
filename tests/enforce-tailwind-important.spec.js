import {
  DEFAULT_IGNORED_CLASSES,
  isMissingImportant,
  resolveIgnored,
  shouldFlag,
} from '../src/enforce-tailwind-important';

describe('GIVEN "enforce-tailwind-important"', () => {
  describe('WHEN "test" important class', () => {
    let isImportantClass = false;

    beforeEach(() => {
      isImportantClass = isMissingImportant('a-class');
    });

    it('THEN the class should not be important', () => {
      expect(isImportantClass).toBe(true);
    });
  });

  describe('WHEN a class is in the ignore list', () => {
    it('THEN "no-gutters" and "container-fluid" are ignored by default', () => {
      expect(DEFAULT_IGNORED_CLASSES).toEqual(
        expect.arrayContaining(['no-gutters', 'container-fluid']),
      );
    });

    it('THEN a default-ignored class is not flagged', () => {
      const ignored = resolveIgnored();

      expect(shouldFlag('no-gutters', ignored)).toBe(false);
      expect(shouldFlag('container-fluid', ignored)).toBe(false);
    });

    it('THEN a real Tailwind class is still flagged', () => {
      const ignored = resolveIgnored();

      expect(shouldFlag('w-full', ignored)).toBe(true);
      expect(shouldFlag('max-w-[800px]', ignored)).toBe(true);
    });

    it('THEN an already-important class is never flagged', () => {
      const ignored = resolveIgnored();

      expect(shouldFlag('w-full!', ignored)).toBe(false);
    });

    it('THEN classes from the "ignore" option are merged with the defaults', () => {
      const ignored = resolveIgnored({ ignore: ['my-legacy-class'] });

      expect(shouldFlag('my-legacy-class', ignored)).toBe(false);
      expect(shouldFlag('no-gutters', ignored)).toBe(false);
      expect(shouldFlag('text-red-500', ignored)).toBe(true);
    });
  });
});
