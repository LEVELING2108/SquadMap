import { expect, test, type Page } from '@playwright/test';

/**
 * The whole account flow against a real backend and a real mail catcher: sign up, stay signed
 * in, log out, log in, and reset a forgotten password with the email that was actually sent.
 *
 * Needs the backend on :8480 and Mailpit (see README "Run it locally"). MAILPIT_URL points at
 * Mailpit's web interface.
 */
const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8425';

type MailpitList = { messages: { ID: string; To: { Address: string }[] }[] };

async function resetLinkFor(email: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const list = (await (await fetch(`${MAILPIT}/api/v1/messages`)).json()) as MailpitList;
        const message = list.messages.find((m) => m.To.some((to) => to.Address === email));
        if (!message) return undefined;
        const full = (await (await fetch(`${MAILPIT}/api/v1/message/${message.ID}`)).json()) as {
          Text: string;
        };
        link = full.Text.match(/https?:\/\/\S+\/reset-password#token=\S+/)?.[0];
        return link;
      },
      { message: `reset email for ${email}`, timeout: 15_000 },
    )
    .toBeTruthy();
  return link!;
}

/** Each run looks like a different visitor, so the per-address rate limits never carry over. */
async function asFreshVisitor(page: Page) {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': `198.51.${octet()}.${octet()}` });
}

test('an account can be created, used, and recovered by email', async ({ page, context }) => {
  const email = `journey-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const firstPassword = 'Kite-7 Rivermoon';
  const newPassword = 'Lantern 42 harbour';
  const scriptErrors: string[] = [];
  page.on('pageerror', (error) => scriptErrors.push(error.message));
  await asFreshVisitor(page);

  await test.step('sign up from the welcome screen', async () => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Get started' }).click();
    await page.getByLabel('Name').fill('Rohan');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(firstPassword);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Hi, Rohan' })).toBeVisible();
  });

  await test.step('stay signed in after a reload', async () => {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Hi, Rohan' })).toBeVisible();
  });

  await test.step('log in page skips straight home while signed in', async () => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/home$/);
  });

  await test.step('log out, and a reload does not sign back in', async () => {
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/home');
    await expect(page.getByRole('heading', { name: 'You are exploring' })).toBeVisible();
  });

  await test.step('a wrong password is refused, the right one works', async () => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('not the password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');

    await page.getByLabel('Password', { exact: true }).fill(firstPassword);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('heading', { name: 'Hi, Rohan' })).toBeVisible();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  let link = '';
  await test.step('ask for a reset link; the email arrives', async () => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page.getByLabel('Email')).toHaveValue(email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('status')).toContainText('Sent! Check your inbox.');
    link = await resetLinkFor(email);
  });

  await test.step('the link sets a new password and leaves the address bar', async () => {
    await page.goto(link);
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    await expect(page).toHaveURL(/\/reset-password$/);
    await page.getByLabel('New password', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible();
  });

  await test.step('the same link, opened again from the email, is refused', async () => {
    const again = await context.newPage();
    await again.goto(link);
    await again.getByLabel('New password', { exact: true }).fill('Another one 99 x');
    await again.getByRole('button', { name: 'Save new password' }).click();
    await expect(again.getByRole('heading', { name: 'This link has expired' })).toBeVisible();
    await again.close();
  });

  await test.step('only the new password works now', async () => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(firstPassword);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    await page.getByLabel('Password', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('heading', { name: 'Hi, Rohan' })).toBeVisible();
  });

  expect(scriptErrors).toEqual([]);
});
