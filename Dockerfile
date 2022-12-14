FROM mcr.microsoft.com/playwright:v1.27.1-focal

# Install nodemon
RUN npm install -g forever

# create root application folder
WORKDIR /app

# COPY code
COPY . /app

RUN npm install --omit=dev

ENTRYPOINT ["forever", "main.js"]