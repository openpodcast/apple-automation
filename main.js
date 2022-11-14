const { chromium, firefox } = require("playwright");
const prompt = require("prompt-sync")();
const fs = require("fs");

const APPLE_LOGIN_URL = "https://appleid.apple.com/sign-in";

// Get environment variables
const ACCOUNT_NAME = process.env.ACCOUNT_NAME;
const PASSWORD = process.env.PASSWORD;
const PHONE_NUMBER_LAST_DIGITS = process.env.PHONE_NUMBER_LAST_DIGITS;
const PODCAST_URL = process.env.PODCAST_URL;

(async () => {
  const browser = await firefox.launch({
    headless: false,
    slowMo: 100,
    devtools: true,
  });

  const page = await browser.newPage();
  await page.goto(APPLE_LOGIN_URL);
  await page.waitForTimeout(5000);

  const frame = await page.frame({
    name: "aid-auth-widget",
  });

  await frame.type("#account_name_text_field", ACCOUNT_NAME);
  await frame.click("#sign-in");
  await frame.click("#password_text_field");
  await frame.type("#password_text_field", PASSWORD);
  await frame.click("#sign-in");
  await frame.waitForTimeout(5000);
  await frame.click(`text=•••${PHONE_NUMBER_LAST_DIGITS}`);

  const code = prompt("Enter verification code: ");
  console.log(`Verification code is ${code}`);

  // click on the first input field with id char0
  await frame.click("#char0");
  // type the code
  await frame.type("#char0", code);

  await frame.waitForSelector("body");

  await page.goto(PODCAST_URL);

  const cookies = await page.context().cookies();
  console.log(cookies);
  const myacinfo = cookies.find((cookie) => cookie.name === "myacinfo");
  const itctx = cookies.find((cookie) => cookie.name === "itctx");

  fs.writeFileSync("cookie.json", JSON.stringify({ myacinfo, itctx }));

  await page.waitForTimeout(200000);

  await browser.close();
})();
