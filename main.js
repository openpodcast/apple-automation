const { chromium, firefox } = require("playwright");
const fs = require("fs");
const express = require("express");

const APPLE_LOGIN_URL = "https://appleid.apple.com/sign-in";

// Get environment variables
const ACCOUNT_NAME = process.env.ACCOUNT_NAME;
const PASSWORD = process.env.PASSWORD;
const PHONE_NUMBER_LAST_DIGITS = process.env.PHONE_NUMBER_LAST_DIGITS;
const PODCAST_URL = process.env.PODCAST_URL;
const PORT = process.env.PORT || 3000;

let verificationCode = null;

const app = express();

// Handle post request with JSON payload. Extract `body` field from JSON payload
app.get("/code", express.json(), (req, res) => {
  // Get Body as get parameter
  const text = req.query.Body;
  console.log(text);
  const codeRegex = /.*#([0-9]{6}) .*/m;

  const match = codeRegex.exec(text);
  if (match) {
    const code = match[1];
    console.log(`Received verification code: ${code}`);

    // Resolve the promise with the code
    verificationCode = code;
  }
  res.status(204).send();
});

app.get("/cookies", async (req, res) => {
  console.log("Received request for cookies");
  const browser = await firefox.launch({
    headless: true,
    slowMo: 100,
    devtools: true,
  });

  const page = await browser.newPage();
  await page.goto(APPLE_LOGIN_URL);

  await page.waitForLoadState("networkidle");
  await page.waitForSelector("iframe[name='aid-auth-widget']");

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
    console.log("Verification code not received");
    await browser.close();
    res.status(400).send("Verification code not received");
    return;
  }

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
