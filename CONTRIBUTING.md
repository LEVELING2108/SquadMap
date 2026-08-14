# 🤝 Contributing to SquadMap

Thank you for your interest in contributing to **SquadMap**! We welcome contributions from developers of all skill levels. Whether you are fixing a bug, adding a new feature, improving documentation, or refining UI design, your help is greatly appreciated.

---

## 📜 Code of Conduct

SquadMap is an open-source project. We expect all contributors to maintain a welcoming, inclusive, and respectful community environment.

---

## 🛠️ How to Contribute

### 1. Fork & Clone the Repository
Start by forking the [SquadMap Repository](https://github.com/LEVELING2108/SquadMap.git) to your GitHub account:

```bash
# Clone your fork locally
git clone https://github.com/YOUR-USERNAME/SquadMap.git
cd SquadMap

# Add upstream remote
git remote add upstream https://github.com/LEVELING2108/SquadMap.git
```

### 2. Install Dependencies & Setup
```bash
npm install
npm run db:generate
```

### 3. Create a Feature Branch
Create a descriptive branch name based on the type of contribution:

```bash
# For new features
git checkout -b feat/battery-saver-toggle

# For bug fixes
git checkout -b fix/leaflet-marker-drift

# For documentation
git checkout -b docs/add-pwa-guide
```

---

## 🏷️ Commit Message Conventions

We follow the **[Conventional Commits](https://www.conventionalcommits.org/)** specification for clean commit history:

| Prefix | Description | Example |
| :--- | :--- | :--- |
| `feat:` | A new user-facing feature | `feat(web): add driving route distance counter` |
| `fix:` | A bug fix | `fix(api): handle missing clerk auth gracefully` |
| `docs:` | Documentation changes | `docs: add contributing guide and license` |
| `refactor:` | Code change that neither fixes a bug nor adds a feature | `refactor(db): optimize participant lookup query` |
| `style:` | Formatting, whitespace, or CSS style updates | `style(ui): update mountain peak background tokens` |

---

## 🧪 Local Testing & Type Check

Before submitting your Pull Request, verify that your code compiles with zero errors:

```bash
# Check TypeScript types across all workspace packages
npm run check-types

# Verify local web and server execution
npx turbo run dev -F web -F server
```

---

## 🚀 Submitting a Pull Request (PR)

1. **Push your branch to your fork**:
   ```bash
   git push origin feat/your-feature-name
   ```

2. **Open a Pull Request**:
   * Navigate to [https://github.com/LEVELING2108/SquadMap](https://github.com/LEVELING2108/SquadMap) and click **New Pull Request**.
   * Select your feature branch against `main`.
   * Provide a clear title and description of the changes made.
   * Reference any related issues (e.g. `Closes #12`).

3. **PR Review**:
   * A project maintainer will review your code.
   * Respond to feedback or requested changes if needed.
   * Once approved, your PR will be merged into `main`!

---

## 📄 License

By contributing to SquadMap, you agree that your contributions will be licensed under the **MIT License**.
