#!/bin/bash
set -e  # Exit on any error

echo "Starting build process..."

# Navigate to frontend directory
cd "Frontend Task Management Page"

# Install dependencies
echo "Installing frontend dependencies..."
npm install

# Build frontend
echo "Building frontend..."
npm run build

# Go back to root
cd ..

# Clean public directory
echo "Cleaning public directory..."
if [ -d "public" ]; then
  rm -rf public/*
else
  mkdir -p public
fi

# Copy built files
echo "Copying built files..."
if [ -d "Frontend Task Management Page/dist" ]; then
  cp -r "Frontend Task Management Page/dist"/* public/
  echo "Build completed successfully!"
else
  echo "Error: Frontend Task Management Page/dist directory not found!"
  exit 1
fi
