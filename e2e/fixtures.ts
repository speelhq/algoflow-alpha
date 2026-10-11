// The `test` every end-to-end spec uses: it fails a test on any uncaught error in the page, which
// unmounts the page and would otherwise surface only as a missing element, with its own message.
import { expect, test as base } from "@playwright/test";

export const test = base.extend<{ pageErrors: void }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
      await use();
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
