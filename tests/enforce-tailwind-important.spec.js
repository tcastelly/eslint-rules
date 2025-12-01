import { isMissingImportant } from '../src/enforce-tailwind-important';

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
});
