# Quick Reference: Versioning & Releases

## Commit Types → Version Bumps

| Commit Type | Example | Version Impact |
|-------------|---------|----------------|
| `fix:` | `fix: resolve login bug` | **Patch** (1.0.1 → 1.0.2) |
| `feat:` | `feat: add user profiles` | **Minor** (1.0.1 → 1.1.0) |
| `feat!:` or `BREAKING CHANGE:` | `feat!: change API structure` | **Major** (1.0.1 → 2.0.0) |
| `docs:`, `style:`, `refactor:`, etc. | `docs: update README` | **Patch** (1.0.1 → 1.0.2) |

## Quick Commands

```bash
# Check next version (without making changes)
npm run check-version

# Create release based on commits
npm run release

# Force specific version bump
npm run release:patch   # Bug fixes
npm run release:minor   # New features
npm run release:major   # Breaking changes

# Preview changes without committing
npm run release:dry
```

## Workflow

1. **Write conventional commits**
   ```bash
   git commit -m "feat: add new command system"
   git commit -m "fix: handle edge case in user validation"
   ```

2. **Push to main**
   ```bash
   git push origin main
   ```

3. **GitHub Actions automatically:**
   - Analyzes commits
   - Bumps version appropriately
   - Updates CHANGELOG.md
   - Creates git tag
   - Pushes changes

## Breaking Changes

To indicate breaking changes, use either:
- `!` after type: `feat!: remove deprecated methods`
- Footer: 
  ```
  feat: add new authentication system
  
  BREAKING CHANGE: old auth methods no longer supported
  ```

## Scoped Commits

Add scope for better organization:
```bash
git commit -m "feat(commands): add moderation tools"
git commit -m "fix(database): resolve connection pooling issue"
git commit -m "docs(api): update endpoint documentation"
```
