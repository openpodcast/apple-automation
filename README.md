# Apple Automation

This is a simple automation to receive your credentials for the Apple Podcasts
Connect website. It requires an SMS service to receive the 2-factor
authentication code.

The output is a JSON file with your session cookie. This is used by our [Apple
connector](https://github.com/openpodcast/apple-connector) to retrieve your
metrics.

## Setup

Create a `.env` file in the root of the project.
Check the `.env.example` file for the required environment variables.

Run `npm install` to install the dependencies.

## Usage

Source the `.env` file and run `npm start` to start the automation.

After that you can retrieve your credentials by requesting the `/cookies`
endpoint.

## License

MIT
