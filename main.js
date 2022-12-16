const { chromium, firefox } = require("playwright");
const fs = require("fs");
const express = require("express");
const dotenv = require("dotenv");
const winston = require("winston");
const AuthController = require("./auth.js");

dotenv.config();

// Get environment variables
const ACCOUNT_NAME = process.env.ACCOUNT_NAME;
const PASSWORD = process.env.PASSWORD;
const PHONE_NUMBER_LAST_DIGITS = process.env.PHONE_NUMBER_LAST_DIGITS;
const PORT = process.env.PORT || 3000;
const LOGLEVEL = process.env.LOGLEVEL || "info";
const HEADLESS = process.env.HEADLESS || "TRUE";
const WAIT_TIME_SECS = process.env.WAIT_TIME_SECS || 60;

const APPLE_LOGIN_URL = `https://podcastsconnect.apple.com`;

const logger = winston.createLogger({
  level: LOGLEVEL,
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

let verificationCode = null;

const waitForVerificationCode = async (maxWaitTime) => {
  let waitTime = 0;
  while (verificationCode === null && waitTime < maxWaitTime) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    waitTime++;
  }
};

// Wait maximum `WAIT_TIME_SECS` seconds in loop until the GLOBAL verification
// code is not null
const getVerificationCode = async (frame) => {
  await waitForVerificationCode(WAIT_TIME_SECS);
  if (verificationCode !== null) {
    return;
  }

  const html = await frame.innerHTML("body");
  if (html.includes("Too many verification codes have been sent")) {
    logger.info(
      "Too many verification codes have been sent. Stopping. Try again later"
    );
    return;
  }

  logger.info("No verification code received. Retrying...");
  await frame.click("#other-opts");
  await frame.click("#try-again-link");
  await waitForVerificationCode(WAIT_TIME_SECS);
};

const app = express();

// throw exception if not authorized
const authController = new AuthController();
app.use(authController.getMiddleware());

// Handle post request with JSON payload. Extract `body` field from JSON payload
app.get("/code", express.json(), (req, res) => {
  // Get Body as get parameter
  const text = req.query.Body;
  logger.info(`sms code received. text: ${text}`);
  const codeRegex = /.*#([0-9]{6}) .*/m;

  const match = codeRegex.exec(text);
  if (match) {
    const code = match[1];
    logger.info(`Received verification code: ${code}`);

    // Resolve the promise with the code
    verificationCode = code;
  } else {
    logger.error(
      `Couldn't extract verification code from text. Text does not match regex. Received text: ${text}`
    );
  }
  res.status(204).send();
});

app.get("/cookies", async (req, res) => {
  logger.info("Received request for cookies");

  const podcastId = res.locals.user.accountId;

  const browser = await chromium.launch({
    headless: HEADLESS === "TRUE",
    slowMo: 100,
  });

  // when using the headless user-agent apple's iframe is not loaded
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36",
  });

  try {
    const page = await context.newPage();

    await page.goto(APPLE_LOGIN_URL);

    // wait for the page to load as a sanity measure
    await page.waitForLoadState("networkidle");

    logger.debug("Waiting for iframe...");
    await page.waitForSelector("#aid-auth-widget-iFrame");

    //contains always the main frame, so we need at least a second one (the iframe)
    const frames = await page.frames();
    if (frames.length < 2) {
      logger.error("Couldn't find iframe");
      await browser.close();
      res.status(400).send("Auth iframe couldn't be loaded");
      return;
    }
    // let's assume the first iframe is always the main frame,
    // so the second one should be our iframe we are looking for
    const frame = await page.frames()[1];

    await frame.waitForSelector("#account_name_text_field");
    await frame.type("#account_name_text_field", ACCOUNT_NAME);
    await frame.click("#sign-in");
    await frame.click("#password_text_field");
    await frame.type("#password_text_field", PASSWORD);
    await frame.click("#sign-in");
    logger.debug("sign in clicked");

    //TODO: replace by waiting for an element instead of waiting 5 secs
    await frame.waitForTimeout(5000);
    await frame.click(`text=••${PHONE_NUMBER_LAST_DIGITS}`);

    logger.debug(
      "Clicked on phone number. Waiting for verification code from phone..."
    );

    await getVerificationCode(frame);

    // Notification code is not returned from getVerificationCode function.
    // Instead it is set in the global variable `verificationCode`.
    const code = verificationCode;
    // Reset verification code for next request
    verificationCode = null;
    if (code === null) {
      logger.error(`Verification code not received`);
      await browser.close();
      res.status(503).send("Verification code not received");
      return;
    }

    logger.debug(`Code ${code} received, entering the code into form now`);

    // click on the first input field with id char0
    await frame.click("#char0");
    await frame.type("#char0", code, { delay: 300 });

    await frame.waitForSelector("body");

    // TODO: Accept browser if needed
    // https://github.com/georgespencer/derogan/blob/bc25a2651006b6356aa19b258076029968f277e0/apple_music.py#L54
    // frame.click("//button[contains(@id,'trust-browser')]").click();

    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(5000);

    logger.debug(
      "Looks good, we should be logged in, so go to podcast dashboard to generate all missing cookies"
    );

    await page.click(".user-profile");

    // TODO: Might switch to `data-provider-id` instead of `data-provider-title`
    await page.locator(`[data-provider-title="${podcastId}"]`).click();

    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(5000);

    const cookies = await page.context().cookies();

    await browser.close();

    res.json(cookies);
  } catch (e) {
    logger.error("playwright error");
    logger.error(e.message);
    await browser.close();
    res
      .status(503)
      .send("error while doing auth magic with apple. try again later.");
    return;
  }
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
