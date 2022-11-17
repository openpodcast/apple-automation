FROM mcr.microsoft.com/playwright:v1.27.1-focal

# Install nodemon
RUN npm install -g nodemon

# create root application folder
WORKDIR /app

# COPY code
COPY . /app

RUN npm install

ENTRYPOINT ["nodemon", "main.js"]