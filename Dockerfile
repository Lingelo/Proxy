FROM node:20

WORKDIR /app

# Copy package.json and yarn.lock
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install

# Copy the rest of the application
COPY . .

# Copy .env-example to .env
RUN cp .env-example .env

# Expose the port specified in .env (default: 7777)
EXPOSE 7777

# Start the application
CMD ["yarn", "dev"]
