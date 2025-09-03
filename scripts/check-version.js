#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getCommitsSinceLastTag() {
  try {
    const lastTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
    return execSync(`git log ${lastTag}..HEAD --oneline`, { encoding: 'utf8' }).trim();
  } catch (error) {
    return execSync('git log --oneline', { encoding: 'utf8' }).trim();
  }
}

function determineReleaseType(commits) {
  console.log('Analyzing commits:');
  console.log(commits);
  console.log('');

  if (!commits) {
    console.log('No new commits found.');
    return null;
  }

  const lines = commits.split('\n');
  let releaseType = 'patch';
  let reasons = [];

  for (const line of lines) {
    // Check for breaking changes
    if (line.match(/^[a-f0-9]+ .+!:/) || line.includes('BREAKING CHANGE')) {
      releaseType = 'major';
      reasons.push(`Breaking change detected: ${line}`);
      break; // Major version takes precedence
    }
    // Check for new features
    else if (line.match(/^[a-f0-9]+ feat(\(.+\))?:/)) {
      if (releaseType !== 'major') {
        releaseType = 'minor';
        reasons.push(`New feature detected: ${line}`);
      }
    }
    // Check for fixes, docs, etc.
    else if (line.match(/^[a-f0-9]+ (fix|docs|style|refactor|perf|test|chore)(\(.+\))?:/)) {
      if (releaseType === 'patch') {
        reasons.push(`${releaseType.charAt(0).toUpperCase() + releaseType.slice(1)} change: ${line}`);
      }
    }
  }

  console.log('Analysis results:');
  reasons.forEach(reason => console.log(`- ${reason}`));
  console.log('');

  return releaseType;
}

function getCurrentVersion() {
  const packageJsonPath = join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

function getNextVersion(current, releaseType) {
  const [major, minor, patch] = current.split('.').map(Number);
  
  switch (releaseType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      return current;
  }
}

function main() {
  console.log('🔍 Analyzing commits for next version...\n');
  
  const commits = getCommitsSinceLastTag();
  const releaseType = determineReleaseType(commits);
  
  if (!releaseType) {
    return;
  }

  const currentVersion = getCurrentVersion();
  const nextVersion = getNextVersion(currentVersion, releaseType);

  console.log(`📦 Current version: ${currentVersion}`);
  console.log(`🚀 Next version: ${nextVersion} (${releaseType})`);
  console.log('');
  console.log('To create this release, run:');
  console.log(`npm run release:${releaseType}`);
  console.log('');
  console.log('Or to see what would be generated:');
  console.log('npm run release:dry');
}

main();
