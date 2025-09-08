export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="container mx-auto px-6 py-8">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">Q</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Quran Bot
            </h1>
          </div>
          <a
            href="#invite"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Add to Discord
          </a>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-6">
        <section className="text-center py-16">
          <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Learn the{" "}
            <span className="bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              Quran
            </span>{" "}
            on Discord
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            Interactive quizzes, experience points, beautiful Arabic
            calligraphy, and personalized learning. Transform your Discord
            server into a Quran learning community.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <a
              href="#invite"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-lg transition-colors text-lg"
            >
              🚀 Add to Your Server
            </a>
            <a
              href="#features"
              className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-semibold py-4 px-8 rounded-lg transition-colors text-lg"
            >
              📖 Explore Features
            </a>
          </div>

          {/* Bot Preview */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-4xl mx-auto">
            <h3 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">
              See Quran Bot in Action
            </h3>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-6 text-left">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-blue-500 rounded-full mr-3"></div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  Quran Bot
                </span>
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded ml-2">
                  BOT
                </span>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 rounded">
                <p className="text-gray-800 dark:text-gray-200 font-mono text-sm">
                  🧩 <strong>Quran Quiz Challenge</strong>
                  <br />
                  <em>Which chapter (surah) is this verse from?</em>
                  <br />
                  Look at the Arabic text and choose the correct answer below.
                </p>
                <div className="mt-4 space-x-2">
                  <button className="bg-blue-500 text-white px-3 py-1 rounded text-sm">
                    A. Al-Fatihah
                  </button>
                  <button className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm">
                    B. Al-Baqarah
                  </button>
                  <button className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm">
                    C. Ali &apos;Imran
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16">
          <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Powerful Features for Quran Learning
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Quiz Types */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">🧩</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                Interactive Quizzes
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Multiple quiz types: Chapter identification, verse order,
                missing words, and translation matching.
              </p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                <li>• Chapter Quiz - Identify verses</li>
                <li>• Ayah Order - Test sequence knowledge</li>
                <li>• Missing Words - Fill in the blanks</li>
                <li>• Translation Quiz - Match meanings</li>
              </ul>
            </div>

            {/* XP System */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">⭐</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                Experience System
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Earn XP for correct answers, level up, build streaks, and
                compete on leaderboards.
              </p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                <li>• 10-15 XP per correct answer</li>
                <li>• Level up every 100 XP</li>
                <li>• Daily streaks and bonuses</li>
                <li>• Server leaderboards</li>
              </ul>
            </div>

            {/* Beautiful Typography */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">🎨</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                Arabic Calligraphy
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Beautiful Quranic text rendering with authentic Arabic fonts and
                visual quiz elements.
              </p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                <li>• Uthmanic Hafs fonts</li>
                <li>• Page-accurate rendering</li>
                <li>• Dynamic image generation</li>
                <li>• Multiple Arabic styles</li>
              </ul>
            </div>

            {/* Multi-language */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">🌍</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                Multi-Language Support
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Available in 8+ languages with localized translations and
                cultural sensitivity.
              </p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                <li>• English, Arabic, Urdu</li>
                <li>• French, Spanish, Turkish</li>
                <li>• Indonesian, German</li>
                <li>• Customizable preferences</li>
              </ul>
            </div>

            {/* Analytics */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                Detailed Analytics
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Track progress with comprehensive statistics and performance
                insights.
              </p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                <li>• Accuracy rates by quiz type</li>
                <li>• Learning progress over time</li>
                <li>• Skill level assessments</li>
                <li>• Personalized recommendations</li>
              </ul>
            </div>

            {/* Community */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                Community Features
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Build learning communities with leaderboards, user profiles, and
                social features.
              </p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                <li>• Server leaderboards</li>
                <li>• User profiles and stats</li>
                <li>• Achievement systems</li>
                <li>• Friendly competition</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Commands Section */}
        <section className="py-16 bg-gradient-to-r from-blue-50 to-green-50 dark:from-gray-800 dark:to-gray-700 rounded-2xl">
          <div className="container mx-auto px-6">
            <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
              Easy-to-Use Commands
            </h2>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  🎮 Quiz Commands
                </h3>
                <div className="space-y-3">
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                    <code className="text-blue-600 font-mono">/quran-quiz</code>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Start a chapter identification quiz
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                    <code className="text-blue-600 font-mono">
                      /ayah-order-quiz
                    </code>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Test verse sequence knowledge
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                    <code className="text-blue-600 font-mono">
                      /translation-quiz
                    </code>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Match verses with translations
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                    <code className="text-blue-600 font-mono">
                      /random-ayah
                    </code>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Get a random verse for reflection
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  👤 User Commands
                </h3>
                <div className="space-y-3">
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                    <code className="text-green-600 font-mono">/register</code>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Create account and set preferences
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                    <code className="text-green-600 font-mono">
                      /quiz-stats
                    </code>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      View detailed performance statistics
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                    <code className="text-green-600 font-mono">
                      /leaderboard
                    </code>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      See top performers in your server
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                    <code className="text-green-600 font-mono">
                      /onboarding
                    </code>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Interactive guide to bot features
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Getting Started */}
        <section className="py-16">
          <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Get Started in 3 Easy Steps
          </h2>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                Add to Discord
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Click the invite link below to add Quran Bot to your Discord
                server with the necessary permissions.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-green-600">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                Register Account
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Use{" "}
                <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  /register
                </code>{" "}
                to create your account and set your language preferences.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-purple-600">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                Start Learning
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Begin with{" "}
                <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  /quran-quiz
                </code>{" "}
                and explore all the interactive features!
              </p>
            </div>
          </div>
        </section>

        {/* Invite Section */}
        <section id="invite" className="py-16 text-center">
          <div className="bg-gradient-to-r from-blue-600 to-green-600 rounded-2xl p-8 text-white">
            <h2 className="text-4xl font-bold mb-4">
              Ready to Transform Your Server?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Join thousands of users already learning the Quran on Discord
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://discord.com/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=2147484672&integration_type=0&scope=bot+applications.commands"
                className="bg-white text-blue-600 hover:bg-gray-100 font-bold py-4 px-8 rounded-lg transition-colors text-lg inline-flex items-center justify-center"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  className="w-6 h-6 mr-2"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
                Add Quran Bot to Discord
              </a>
              <a
                href="/docs"
                className="border-2 border-white text-white hover:bg-white hover:text-blue-600 font-semibold py-4 px-8 rounded-lg transition-colors text-lg"
              >
                📚 View Documentation
              </a>
            </div>

            <p className="text-sm mt-6 opacity-75">
              Free forever • No premium features • Open source
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">Q</span>
                </div>
                <h3 className="text-xl font-bold">Quran Bot</h3>
              </div>
              <p className="text-gray-400">
                Making Quran learning accessible and engaging for Discord
                communities worldwide.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Features</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Interactive Quizzes</li>
                <li>XP System</li>
                <li>Multi-language Support</li>
                <li>Arabic Calligraphy</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Documentation</li>
                <li>Discord Server</li>
                <li>GitHub Issues</li>
                <li>FAQ</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a
                    href="https://github.com/runsdev/discord-bot"
                    className="hover:text-white transition-colors"
                  >
                    GitHub Repository
                  </a>
                </li>
                <li>
                  <a
                    href="#invite"
                    className="hover:text-white transition-colors"
                  >
                    Invite Bot
                  </a>
                </li>
                <li>
                  <a
                    href="/privacy"
                    className="hover:text-white transition-colors"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href="/terms"
                    className="hover:text-white transition-colors"
                  >
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-8 mt-8 text-center text-gray-400">
            <p>&copy; 2025 Quran Bot. Made with ❤️ for the Muslim community.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
