# Discord Bot

A discord bot by runsha

## Versioning and Changelog

This project uses automated semantic versioning based on conventional commits. The version number and changelog are automatically generated when you push commits to the main branch.

### How It Works

The system follows [Semantic Versioning (SemVer)](https://semver.org/):

- **MAJOR** version when you make incompatible API changes
- **MINOR** version when you add functionality in a backwards compatible manner
- **PATCH** version when you make backwards compatible bug fixes

### Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types:

- **feat**: A new feature (minor version bump)
- **fix**: A bug fix (patch version bump)
- **docs**: Documentation only changes (patch version bump)
- **style**: Changes that do not affect the meaning of the code (patch version bump)
- **refactor**: A code change that neither fixes a bug nor adds a feature (patch version bump)
- **perf**: A code change that improves performance (patch version bump)
- **test**: Adding missing tests or correcting existing tests (patch version bump)
- **build**: Changes that affect the build system or external dependencies (patch version bump)
- **ci**: Changes to our CI configuration files and scripts (patch version bump)
- **chore**: Other changes that don't modify src or test files (patch version bump)

#### Breaking Changes (Major version bump):

- Add `!` after the type/scope: `feat!: remove deprecated API`
- Or include `BREAKING CHANGE:` in the commit footer

### Examples:

```bash
# Patch version (1.0.1 -> 1.0.2)
git commit -m "fix: resolve connection timeout issue"

# Minor version (1.0.1 -> 1.1.0)
git commit -m "feat: add new slash command for server stats"

# Major version (1.0.1 -> 2.0.0)
git commit -m "feat!: restructure bot command system"

# With scope
git commit -m "feat(commands): add moderation commands"
```

### Available Scripts

```bash
# Check what the next version would be
npm run check-version

# Create a release (auto-determines type based on commits)
npm run release

# Force specific release types
npm run release:patch    # 1.0.1 -> 1.0.2
npm run release:minor    # 1.0.1 -> 1.1.0
npm run release:major    # 1.0.1 -> 2.0.0

# Create a prerelease (beta, alpha, etc.)
npm run release:pre

# Preview what would be generated without making changes
npm run release:dry
```

### Automated Workflow

1. **Make commits** using conventional commit format
2. **Push to main branch** - GitHub Actions will:
   - Analyze your commits since the last release
   - Determine the appropriate version bump
   - Generate/update CHANGELOG.md
   - Create a git tag
   - Push the changes back to main

### Manual Release

You can also trigger releases manually through GitHub Actions:

1. Go to the "Actions" tab in your repository
2. Select "Manual Release" workflow
3. Click "Run workflow"
4. Choose the release type (patch/minor/major/prerelease)

### Changelog

The changelog is automatically generated in `CHANGELOG.md` and includes:

- All conventional commits grouped by type
- Links to commits and issues
- Release dates and version numbers

### Local Development

Before committing, you can check what the next version would be:

```bash
npm run check-version
```

This will analyze your commits and show you what type of release would be created.

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your bot token
4. Start the bot: `npm start`

## Contributing

When contributing to this project, please:

1. Follow the conventional commit format
2. Ensure your commits accurately reflect the type of change
3. Test your changes before committing
4. Use descriptive commit messages

The versioning system will automatically handle releases when your changes are merged to main.
