const { chromium, firefox } = require("playwright");
const fs = require("fs");
const express = require("express");
const dotenv = require('dotenv');
const winston = require('winston');

const APPLE_LOGIN_URL = "https://appleid.apple.com/sign-in";

dotenv.config();

// Get environment variables
const ACCOUNT_NAME = process.env.ACCOUNT_NAME;
const PASSWORD = process.env.PASSWORD;
const PHONE_NUMBER_LAST_DIGITS = process.env.PHONE_NUMBER_LAST_DIGITS;
const PODCAST_URL = process.env.PODCAST_URL;
const PORT = process.env.PORT || 3000;
const LOGLEVEL = process.env.LOGLEVEL || "info";

const logger = winston.createLogger({
  level: LOGLEVEL,
  format: winston.format.json(),
  transports: [new winston.transports.Console(),],
});


let verificationCode = null;

const app = express();

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
  }
  res.status(204).send();
});

app.get("/cookies", async (req, res) => {
  logger.info("Received request for cookies");
  const browser = await firefox.launch({
    headless: false,
    slowMo: 100,
    devtools: true,
  });

  const page = await browser.newPage();
  await page.goto(APPLE_LOGIN_URL);

  await page.waitForLoadState("networkidle");
  await page.waitForSelector("iframe[name='aid-auth-widget']");

  let frame = await page.frame({
    name: "aid-auth-widget",
  });

  //lets try to reload
  if (!frame) {
    await page.waitForTimeout(15000);
    logger.debug("Couldn't load iframe, so let's try to reload")
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("iframe[name='aid-auth-widget']");
    frame = await page.frame({
      name: "aid-auth-widget",
    });
    //if we still can't find it, give up
    if (!frame) {
      logger.error("Couldn't load iframe the second time, giving up")
      await browser.close();
      res.status(400).send("Auth iframe couldn't be loaded");
      return;
    }
  }

  await frame.waitForSelector("#account_name_text_field");
  await frame.type("#account_name_text_field", ACCOUNT_NAME);
  await frame.click("#sign-in");
  await frame.click("#password_text_field");
  await frame.type("#password_text_field", PASSWORD);
  await frame.click("#sign-in");
  //TODO: replace by waiting for an element instead of waiting 5 secs
  await frame.waitForTimeout(5000);
  await frame.click(`text=••${PHONE_NUMBER_LAST_DIGITS}`);

  logger.debug("Clicked on the phone number and waiting...")

  // Wait maximum 30 seconds in loop until the verification code is not null
  let waitTime = 0;
  while (verificationCode === null && waitTime < 30) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    waitTime++;
  }

  const code = verificationCode;
  // Reset verification code for next request
  verificationCode = null;
  if (code === null) {
    logger.error("Verification code not received, waited 30sec");
    await browser.close();
    res.status(400).send("Verification code not received");
    return;
  }

  logger.debug("Code received, entering the code into form now")

  // click on the first input field with id char0
  await frame.click("#char0");
  await frame.type("#char0", code[0]);
  await frame.waitForTimeout(Math.random() * 1000 + 500);

  await frame.click("#char1");
  await frame.type("#char1", code[1]);
  await frame.waitForTimeout(Math.random() * 1000 + 500);

  await frame.click("#char2");
  await frame.type("#char2", code[2]);
  await frame.waitForTimeout(Math.random() * 1000 + 500);

  await frame.click("#char3");
  await frame.type("#char3", code[3]);
  await frame.waitForTimeout(Math.random() * 1000 + 500);

  await frame.click("#char4");
  await frame.type("#char4", code[4]);
  await frame.waitForTimeout(Math.random() * 1000 + 500);

  await frame.click("#char5");
  await frame.type("#char5", code[5]);

  await frame.waitForSelector("body");

  // TODO: Accept browser if needed
  // https://github.com/georgespencer/derogan/blob/bc25a2651006b6356aa19b258076029968f277e0/apple_music.py#L54
  // frame.click("//button[contains(@id,'trust-browser')]").click();

  await page.waitForTimeout(5000);
  await page.waitForLoadState("networkidle");

  logger.debug("Looks good, we should be logged in, so goto podcast dashboard to generate all missing cookies")

  await page.goto(PODCAST_URL);
  await page.waitForSelector("body");

  await page.waitForTimeout(5000);
  await page.waitForLoadState("networkidle");

  const cookies = await page.context().cookies();
  console.log(cookies);
  // const myacinfo = cookies.find((cookie) => cookie.name === "myacinfo");
  // const itctx = cookies.find((cookie) => cookie.name === "itctx");
  // fs.writeFileSync("cookie.json", JSON.stringify({ myacinfo, itctx }));
  // await page.waitForTimeout(5000);

  await browser.close();

  res.json(cookies);
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
