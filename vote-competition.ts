import { chromium, Browser, Page } from 'playwright';

const FORM_URL = 'https://prettyform.addxt.com/a/form/vf/1FAIpQLSfjpkfptJsqvq33PTUdcbAUl1_yWxfGip1DaFfJBRybNG8XEw';
const TARGET_BUSINESS = 'Bubbles Haircare for Kids - Saint John';
const TARGET_CATEGORY = 'Services - Best Barber/Hairdresser';

interface VoteConfig {
  email: string;
  headless: boolean;
  uiMode: boolean;
}

async function submitVote(page: Page, email: string): Promise<void> {
  console.log(`Starting vote submission for: ${email}`);

  // Step 1: Enter email address
  console.log('Step 1: Entering email address...');
  const emailInput = page.locator('input[type="text"][placeholder="Your email address"]');
  await emailInput.fill(email);

  // Step 2: Click Next until we reach Services category
  console.log('Step 2: Clicking Next to navigate to Services category...');
  let pageCount = 0;
  let categoryFound = false;

  while (!categoryFound && pageCount < 10) {
    // Check if we're on the Services - Best Barber/Hairdresser category
    const categoryLabel = page.locator(`xpath=//div[contains(@class, "MuiGrid-item")][.//div[contains(normalize-space(), "${TARGET_CATEGORY}")]]`);
    if (await categoryLabel.isVisible()) {
      console.log(`Found target category: ${TARGET_CATEGORY}`);
      categoryFound = true;
      break;
    }

    // Click Next button
    const nextButton = page.locator('button:has-text("Next")').first();
    if (await nextButton.isVisible()) {
      console.log(`Clicking Next (page ${pageCount + 1})...`);
      await nextButton.click();
      pageCount++;
    } else {
      throw new Error('Could not find Next button');
    }
  }

  if (!categoryFound) {
    throw new Error(`Could not find target category: ${TARGET_CATEGORY}`);
  }

  // Step 3: Select the business from dropdown (MUI Select component)
  console.log(`Step 3: Selecting business: ${TARGET_BUSINESS}...`);
  
  // Find the grid item containing the category, then find the listbox within it
  const selectField = page.locator(`xpath=//div[contains(@class, "MuiGrid-item")][.//div[contains(normalize-space(), "${TARGET_CATEGORY}")]]//div[@role="button"][@aria-haspopup="listbox"]`).first();
  
  if (!await selectField.isVisible()) {
    throw new Error('Could not find dropdown select field for category');
  }
  
  await selectField.click();
  await page.waitForSelector('li[role="option"]');
  
  // Find and click the option containing the business name
  const businessOption = page.locator(`xpath=//li[@role="option" and contains(normalize-space(), "${TARGET_BUSINESS}")]`).first();
  
  if (!await businessOption.isVisible()) {
    throw new Error(`Could not find business option: ${TARGET_BUSINESS}`);
  }
  
  await businessOption.click();

  console.log('Step 4: Clicking Next to continue...');
  const nextButton = page.locator('button:has-text("Next")').first();
  await nextButton.click();

  // Step 5: Click Next several more times and look for "Staying up to date" question
  console.log('Step 5: Navigating through remaining pages...');
  let stayingUpToDateFound = false;
  let clickCount = 0;
  const maxClicks = 15;

  while (!stayingUpToDateFound && clickCount < maxClicks) {
    // Check for the "Staying up to date" question
    const questionLabel = page.locator('text=Staying up to date');
    if (await questionLabel.isVisible()) {
      console.log('Found "Staying up to date" question');
      stayingUpToDateFound = true;
      break;
    }

    const nextBtn = page.locator('button:has-text("Next")');
    if (await nextBtn.isVisible()) {
      console.log(`Clicking Next (click ${clickCount + 1})...`);
      await nextBtn.click();
      clickCount++;
    } else {
      // No more next buttons, might be on a different question type
      console.log('No visible Next button, checking for other navigation elements...');
      break;
    }
  }

  if (!stayingUpToDateFound) {
    throw new Error('Could not find "Staying up to date" question');
  }

  // Step 6: Select "No" for the "Staying up to date" question
  console.log('Step 6: Selecting "No" for "Staying up to date" question...');
  
  // Find the radiogroup and select the second input (No option)
  const radioGroup = page.locator('[role="radiogroup"]').first();
  
  if (!await radioGroup.isVisible()) {
    throw new Error('Could not find radiogroup for "Staying up to date" question');
  }
  
  // Get the second radio input within the radiogroup
  const noRadio = radioGroup.locator('input[type="radio"]').nth(1);
  
  if (!await noRadio.isVisible()) {
    throw new Error('Could not find "No" radio option');
  }
  
  await noRadio.click();

  // Step 7: Submit the form
  console.log('Step 7: Submitting the form...');
  const submitButton = page.locator('button:has-text("Submit")').first();
  
  if (!await submitButton.isVisible()) {
    throw new Error('Could not find Submit button');
  }
  
  await submitButton.click();
  
  // Step 8: Validate successful submission
  console.log('Step 8: Validating submission confirmation...');
  const successMessage = page.locator('text=Your submission has been received.');
  await successMessage.waitFor({ state: 'visible', timeout: 5000 });
  
  console.log(`✓ Vote submitted successfully for: ${email}`);
}

async function voteWithEmail(config: VoteConfig): Promise<void> {
  let browser: Browser | null = null;
  
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Voting for: ${config.email}`);
    console.log(`Headless mode: ${config.headless}`);
    console.log(`${'='.repeat(60)}\n`);

    // Launch browser
    browser = await chromium.launch({ 
      headless: config.headless
    });
    const page = await browser.newPage();

    // Enable inspector/UI mode if requested
    if (config.uiMode) {
      await page.pause();
    }

    // Navigate to form
    console.log(`Navigating to: ${FORM_URL}`);
    await page.goto(FORM_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Wait for form to fully load

    // Submit vote
    await submitVote(page, config.email);

    await page.close();
  } catch (error) {
    console.error(`✗ Error submitting vote for ${config.email}:`, error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function main(): Promise<void> {
  // Configuration
  const emails = process.env.EMAILS?.split(',') || [];
  const headless = process.env.HEADLESS !== 'false';
  const uiMode = process.env.UI === 'true';

  if (emails.length === 0) {
    console.error('Error: No emails provided.');
    console.error('Usage: EMAILS="email1@example.com,email2@example.com" npx ts-node vote-competition.ts');
    console.error('       UI mode: EMAILS="email@example.com" UI=true npx ts-node vote-competition.ts');
    console.error('       Non-headless: EMAILS="email@example.com" HEADLESS=false npx ts-node vote-competition.ts');
    process.exit(1);
  }

  console.log(`\nPlaying votes for ${emails.length} email(s)`);
  console.log(`Headless mode: ${headless}`);
  console.log(`UI mode: ${uiMode}\n`);

  let successCount = 0;
  let failureCount = 0;

  for (const email of emails) {
    try {
      await voteWithEmail({ email: email.trim(), headless, uiMode });
      successCount++;
    } catch (error) {
      failureCount++;
      console.error(`Failed to vote for ${email}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Voting Summary:`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Failed: ${failureCount}`);
  console.log(`${'='.repeat(60)}\n`);

  process.exit(failureCount > 0 ? 1 : 0);
}

main().catch(console.error);