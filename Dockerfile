# Use an official Node.js image as the base image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock) to the working directory
# and install dependencies. Use a separate step for caching.
COPY package*.json ./
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

ARG JWT_SECRET
ENV JWT_SECRET=$JWT_SECRET

# Build the Next.js application
RUN npm run build

# Expose the port the application runs on (default is 3000)
EXPOSE 3002

# Command to run the application
CMD ["npm", "start"]
