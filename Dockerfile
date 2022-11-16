FROM mcr.microsoft.com/playwright:v1.27.1-focal

# COPY code
COPY . /app

WORKDIR /app
RUN npm install

ENTRYPOINT ["node", "main.js"]
