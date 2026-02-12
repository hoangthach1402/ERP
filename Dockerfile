# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies including devDependencies for development
RUN npm install

# Copy application code
COPY . .

# Create database directory
RUN mkdir -p /app/database /app/logs

# Initialize database on container start (optional, will run on app start)
RUN node src/models/initDatabase.js || true

# Expose port
EXPOSE 3000

# Use nodemon for development, node for production
ENV NODE_ENV=development
CMD ["npm", "run", "dev"]
