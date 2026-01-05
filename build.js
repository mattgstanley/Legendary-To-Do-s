#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting build process...');

try {
  // Navigate to frontend directory and install
  console.log('Installing frontend dependencies...');
  execSync('npm install', {
    cwd: path.join(__dirname, 'Frontend Task Management Page'),
    stdio: 'inherit'
  });

  // Build frontend
  console.log('Building frontend...');
  execSync('npm run build', {
    cwd: path.join(__dirname, 'Frontend Task Management Page'),
    stdio: 'inherit'
  });

  // Clean public directory
  console.log('Cleaning public directory...');
  const publicDir = path.join(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    const files = fs.readdirSync(publicDir);
    for (const file of files) {
      fs.rmSync(path.join(publicDir, file), { recursive: true, force: true });
    }
  } else {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Copy built files
  console.log('Copying built files...');
  const distDir = path.join(__dirname, 'Frontend Task Management Page', 'dist');
  if (!fs.existsSync(distDir)) {
    throw new Error('Frontend Task Management Page/dist directory not found!');
  }

  const copyRecursiveSync = (src, dest) => {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      fs.readdirSync(src).forEach(childItemName => {
        copyRecursiveSync(
          path.join(src, childItemName),
          path.join(dest, childItemName)
        );
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  };

  copyRecursiveSync(distDir, publicDir);

  // Create a package.json in public to tell Vercel this is a static site (not serverless)
  // This prevents Vercel from looking for server entrypoints in the output directory
  const publicPackageJson = {
    "name": "static-site",
    "version": "1.0.0",
    "private": true
  };
  fs.writeFileSync(
    path.join(publicDir, 'package.json'),
    JSON.stringify(publicPackageJson, null, 2)
  );

  console.log('Build completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
