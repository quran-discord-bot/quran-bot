import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { PrismaClient } from "../../generated/prisma/index.js";

const prisma = new PrismaClient();

export const data = new SlashCommandBuilder()
  .setName("onboarding")
  .setDescription(
    "Learn how to use the bot and discover all available features"
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;

    // Check if user is registered
    const user = await prisma.user.findUnique({
      where: { discordId: userId },
      include: {
        experience: true,
        settings: true,
      },
    });

    const isRegistered = !!user;
    const currentXP = user?.experience?.experience || 0;
    const currentLevel = Math.floor(currentXP / 100) + 1;

    // Create main onboarding embed
    const mainEmbed = new EmbedBuilder()
      .setTitle("🎉 Welcome to the Quran Bot!")
      .setDescription(
        "Discover the beauty of Quran through interactive quizzes and learning. " +
          "Earn experience points, climb levels, and test your knowledge!"
      )
      .setColor(0x4dabf7)
      .addFields(
        {
          name: "🚀 Getting Started",
          value: isRegistered
            ? `✅ You're already registered!\n**Level:** ${currentLevel} | **XP:** ${currentXP}`
            : "❗ Use `/register` to create your account and start earning XP!",
          inline: false,
        },
        {
          name: "🧩 Quiz Types Available",
          value:
            "📖 **Chapter Quiz** - Identify which chapter a verse belongs to\n" +
            "🔢 **Ayah Order Quiz** - Test your knowledge of verse sequences\n" +
            "🔍 **Missing Words Quiz** - Fill in the missing words from verses\n" +
            "🌟 **Translation Quiz** - Match verses with their translations",
          inline: false,
        },
        {
          name: "💫 Experience System",
          value:
            "🏆 **Earn XP** by answering quiz questions correctly\n" +
            "⭐ **Level up** every 100 XP to unlock new features\n" +
            "🔥 **Build streaks** by answering consecutively correct\n" +
            "📊 **Track progress** with detailed statistics",
          inline: false,
        },
        {
          name: "🎯 XP Rewards Breakdown",
          value:
            "✅ **Chapter Quiz:** +10 XP (correct) | -2 XP (wrong)\n" +
            "✅ **Advanced Mode:** +15 XP (correct) | -7 XP (wrong)\n" +
            "✅ **Other Quizzes:** Varies by difficulty\n" +
            "⏰ **Timeout Penalty:** Small XP reduction",
          inline: false,
        }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({
        text: "Use the buttons below to explore different commands!",
      })
      .setTimestamp();

    // Create command buttons
    const commandRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("onboard_quiz_commands")
        .setLabel("📚 Quiz Commands")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("onboard_user_commands")
        .setLabel("👤 User Commands")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("onboard_tips")
        .setLabel("💡 Pro Tips")
        .setStyle(ButtonStyle.Success)
    );

    const utilityRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("onboard_levels")
        .setLabel("⭐ Level System")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("onboard_features")
        .setLabel("🎨 Features")
        .setStyle(ButtonStyle.Primary)
    );

    const response = await interaction.editReply({
      embeds: [mainEmbed],
      components: [commandRow, utilityRow],
    });

    // Create collector for button interactions
    const collector = response.createMessageComponentCollector({
      time: 300000, // 5 minutes
      filter: (i) => i.user.id === userId,
    });

    collector.on("collect", async (buttonInteraction) => {
      try {
        await buttonInteraction.deferUpdate();

        let embed;
        switch (buttonInteraction.customId) {
          case "onboard_quiz_commands":
            embed = createQuizCommandsEmbed();
            break;
          case "onboard_user_commands":
            embed = createUserCommandsEmbed(isRegistered);
            break;
          case "onboard_tips":
            embed = createTipsEmbed();
            break;
          case "onboard_levels":
            embed = createLevelSystemEmbed(currentLevel, currentXP);
            break;
          case "onboard_features":
            embed = createFeaturesEmbed();
            break;
          default:
            return;
        }

        // Create back button
        const backButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("onboard_back")
            .setLabel("← Back to Main")
            .setStyle(ButtonStyle.Secondary)
        );

        await buttonInteraction.editReply({
          embeds: [embed],
          components: [backButton],
        });
      } catch (error) {
        console.error("Error handling button interaction:", error);
      }
    });

    // Handle back button
    collector.on("collect", async (buttonInteraction) => {
      if (buttonInteraction.customId === "onboard_back") {
        try {
          await buttonInteraction.deferUpdate();
          await buttonInteraction.editReply({
            embeds: [mainEmbed],
            components: [commandRow, utilityRow],
          });
        } catch (error) {
          console.error("Error handling back button:", error);
        }
      }
    });

    collector.on("end", async () => {
      try {
        // Disable all buttons when collector expires
        const disabledCommandRow = new ActionRowBuilder().addComponents(
          ...commandRow.components.map((button) =>
            ButtonBuilder.from(button).setDisabled(true)
          )
        );

        const disabledUtilityRow = new ActionRowBuilder().addComponents(
          ...utilityRow.components.map((button) =>
            ButtonBuilder.from(button).setDisabled(true)
          )
        );

        await interaction.editReply({
          embeds: [mainEmbed],
          components: [disabledCommandRow, disabledUtilityRow],
        });
      } catch (error) {
        console.error("Error disabling buttons:", error);
      }
    });
  } catch (error) {
    console.error("Error in onboarding command:", error);

    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Onboarding Error")
      .setDescription(
        "Failed to load onboarding guide. Please try again later."
      )
      .setColor(0xff6b6b)
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  } finally {
    await prisma.$disconnect();
  }
}

function createQuizCommandsEmbed() {
  return new EmbedBuilder()
    .setTitle("📚 Quiz Commands Guide")
    .setDescription(
      "Master your Quran knowledge with these interactive quizzes!"
    )
    .setColor(0x7c3aed)
    .addFields(
      {
        name: "🧩 `/quran-quiz`",
        value:
          "**Challenge:** Identify which chapter a verse belongs to\n" +
          "**Difficulty:** Beginner to Advanced\n" +
          "**Rewards:** 10-15 XP per correct answer\n" +
          "**Features:** Advanced mode unlocks after 5 daily attempts",
        inline: false,
      },
      {
        name: "🔢 `/ayah-order-quiz`",
        value:
          "**Challenge:** Test your knowledge of verse sequences\n" +
          "**Difficulty:** Intermediate\n" +
          "**Rewards:** Variable XP based on performance\n" +
          "**Features:** Sequential verse order challenges",
        inline: false,
      },
      {
        name: "🔍 `/missing-words-quiz`",
        value:
          "**Challenge:** Fill in missing words from Quranic verses\n" +
          "**Difficulty:** Advanced\n" +
          "**Rewards:** Higher XP for accuracy\n" +
          "**Features:** Tests memorization and understanding",
        inline: false,
      },
      {
        name: "🌟 `/translation-quiz`",
        value:
          "**Challenge:** Match verses with their translations\n" +
          "**Difficulty:** Intermediate to Advanced\n" +
          "**Rewards:** Language comprehension XP\n" +
          "**Features:** Multi-language support available",
        inline: false,
      },
      {
        name: "📖 `/random-ayah`",
        value:
          "**Feature:** Get a random verse for reflection\n" +
          "**Benefits:** Daily inspiration and learning\n" +
          "**Languages:** Multiple translation options\n" +
          "**Usage:** Perfect for daily Quran reading",
        inline: false,
      }
    )
    .setFooter({
      text: "💡 Start with /quran-quiz - it's perfect for beginners!",
    })
    .setTimestamp();
}

function createUserCommandsEmbed(isRegistered) {
  return new EmbedBuilder()
    .setTitle("👤 User Management Commands")
    .setDescription("Manage your account and track your progress!")
    .setColor(0x059669)
    .addFields(
      {
        name: "🎯 `/register`",
        value: isRegistered
          ? "✅ You're already registered!\n*Configure language and theme preferences*"
          : "❗ **Start here!** Register to unlock all bot features\n*Choose your language and theme*",
        inline: false,
      },
      {
        name: "📊 `/quiz-stats`",
        value:
          "**View:** Detailed quiz performance statistics\n" +
          "**Features:** Accuracy rates, attempt counts, skill level\n" +
          "**Compare:** View other users' stats (if public)\n" +
          "**Track:** Progress over time and improvement areas",
        inline: false,
      },
      {
        name: "⚙️ `/settings`",
        value:
          "**Customize:** Language preferences for translations\n" +
          "**Theme:** Light or dark mode for embeds\n" +
          "**Privacy:** Control visibility of your statistics\n" +
          "**Notifications:** Manage quiz reminders (coming soon)",
        inline: false,
      },
      {
        name: "🏆 `/leaderboard`",
        value:
          "**Rankings:** See top performers in your server\n" +
          "**Categories:** XP, accuracy, quiz attempts\n" +
          "**Competition:** Friendly rivalry with other users\n" +
          "**Motivation:** Climb the ranks and earn recognition",
        inline: false,
      },
      {
        name: "👤 `/user [user]`",
        value:
          "**Profile:** View any user's public information\n" +
          "**Stats:** Level, XP, registration date\n" +
          "**Achievements:** Special badges and milestones\n" +
          "**Quick Access:** Check friends' progress",
        inline: false,
      }
    )
    .setFooter({
      text: isRegistered
        ? "Use /quiz-stats to see your detailed performance!"
        : "Register first to unlock these features!",
    })
    .setTimestamp();
}

function createTipsEmbed() {
  return new EmbedBuilder()
    .setTitle("💡 Pro Tips & Strategies")
    .setDescription("Master the bot and maximize your learning experience!")
    .setColor(0xf59e0b)
    .addFields(
      {
        name: "🎯 Quiz Strategy",
        value:
          "• **Start with Chapter Quiz** - builds foundational knowledge\n" +
          "• **Play daily** - consistency beats intensity\n" +
          "• **Focus on accuracy** over speed initially\n" +
          "• **Learn from mistakes** - wrong answers teach you most",
        inline: false,
      },
      {
        name: "💫 XP Optimization",
        value:
          "• **Maintain streaks** for bonus multipliers (coming soon)\n" +
          "• **Complete daily challenges** for extra XP\n" +
          "• **Advanced mode** gives more XP but requires more skill\n" +
          "• **Avoid timeouts** to prevent XP penalties",
        inline: false,
      },
      {
        name: "📚 Learning Approach",
        value:
          "• **Study chapter names** in both Arabic and English\n" +
          "• **Listen to recitations** to familiarize with verses\n" +
          "• **Read translations** to understand meanings\n" +
          "• **Practice regularly** - even 5 minutes daily helps",
        inline: false,
      },
      {
        name: "🔥 Advanced Techniques",
        value:
          "• **Unlock advanced mode** by playing 5+ daily attempts\n" +
          "• **Use `/random-ayah`** for daily inspiration and learning\n" +
          "• **Track progress** with `/quiz-stats` weekly\n" +
          "• **Set personal goals** for XP and accuracy targets",
        inline: false,
      },
      {
        name: "🎨 Customization",
        value:
          "• **Set your language** for comfortable translations\n" +
          "• **Choose dark/light theme** for better visibility\n" +
          "• **Update settings** as you learn and grow\n" +
          "• **Share progress** with friends for motivation",
        inline: false,
      }
    )
    .setFooter({
      text: "🌟 Remember: Consistency and patience lead to mastery!",
    })
    .setTimestamp();
}

function createLevelSystemEmbed(currentLevel, currentXP) {
  const xpForNextLevel = currentLevel * 100 - currentXP;
  const progressPercent = ((currentXP % 100) / 100) * 100;

  return new EmbedBuilder()
    .setTitle("⭐ Level System & Progression")
    .setDescription("Understand how the XP and leveling system works!")
    .setColor(0x8b5cf6)
    .addFields(
      {
        name: "📊 Your Current Progress",
        value:
          `**Current Level:** ${currentLevel}\n` +
          `**Current XP:** ${currentXP}\n` +
          `**XP to Next Level:** ${xpForNextLevel}\n` +
          `**Progress:** ${progressPercent.toFixed(1)}% to Level ${
            currentLevel + 1
          }`,
        inline: false,
      },
      {
        name: "🎯 How Leveling Works",
        value:
          "• **100 XP per level** - clear and achievable goals\n" +
          "• **No level cap** - keep growing indefinitely\n" +
          "• **XP from quizzes** - earn through active participation\n" +
          "• **Bonus XP events** - special occasions and achievements",
        inline: false,
      },
      {
        name: "💎 Level Benefits",
        value:
          "• **Recognition** - Higher levels show dedication\n" +
          "• **Leaderboard ranking** - Compete with others\n" +
          "• **Future unlocks** - New features for higher levels\n" +
          "• **Achievement badges** - Special milestones",
        inline: false,
      },
      {
        name: "🏆 Skill Level Tiers",
        value:
          "🌱 **Beginner** - Starting your journey (0-10 attempts)\n" +
          "📚 **Intermediate** - Building knowledge (10+ attempts, 50%+ accuracy)\n" +
          "⭐ **Advanced** - Strong foundation (20+ attempts, 60%+ accuracy)\n" +
          "🔥 **Expert** - Impressive skills (30+ attempts, 70%+ accuracy)\n" +
          "👑 **Master** - Exceptional mastery (50+ attempts, 80%+ accuracy)",
        inline: false,
      },
      {
        name: "📈 Progression Tips",
        value:
          "• **Daily practice** accelerates level growth\n" +
          "• **Accuracy matters** more than speed\n" +
          "• **Diverse quizzes** provide well-rounded XP\n" +
          "• **Stay consistent** for steady progression",
        inline: false,
      }
    )
    .setFooter({
      text: "🎉 Every level milestone is an achievement to celebrate!",
    })
    .setTimestamp();
}

function createFeaturesEmbed() {
  return new EmbedBuilder()
    .setTitle("🎨 Bot Features & Capabilities")
    .setDescription("Discover all the amazing features this bot offers!")
    .setColor(0x06b6d4)
    .addFields(
      {
        name: "🖼️ Visual Elements",
        value:
          "• **Arabic text rendering** - Beautiful Quranic calligraphy\n" +
          "• **Custom fonts** - Authentic Arabic typography\n" +
          "• **Dynamic images** - Generated quiz visuals\n" +
          "• **Rich embeds** - Colorful and informative displays",
        inline: false,
      },
      {
        name: "🌍 Multi-Language Support",
        value:
          "• **8+ Languages** - English, Arabic, Urdu, French, and more\n" +
          "• **Translation options** - Multiple interpretation choices\n" +
          "• **Localized interface** - Commands in your language\n" +
          "• **Cultural sensitivity** - Respectful presentation",
        inline: false,
      },
      {
        name: "📊 Advanced Analytics",
        value:
          "• **Detailed statistics** - Track every aspect of progress\n" +
          "• **Performance insights** - Identify strengths and weaknesses\n" +
          "• **Historical data** - See improvement over time\n" +
          "• **Comparative analysis** - Compare with other users",
        inline: false,
      },
      {
        name: "🎮 Interactive Elements",
        value:
          "• **Button-based quizzes** - Easy and intuitive interface\n" +
          "• **Dropdown menus** - Advanced difficulty options\n" +
          "• **Real-time feedback** - Instant results and explanations\n" +
          "• **Timeout handling** - Fair play mechanisms",
        inline: false,
      },
      {
        name: "🔐 Privacy & Security",
        value:
          "• **Secure data storage** - Your information is protected\n" +
          "• **Optional sharing** - Control what others can see\n" +
          "• **GDPR compliance** - Respectful data handling\n" +
          "• **No spam** - Quality interactions only",
        inline: false,
      },
      {
        name: "🚀 Upcoming Features",
        value:
          "• **Daily challenges** - Special themed quizzes\n" +
          "• **Achievement system** - Unlock badges and rewards\n" +
          "• **Voice integration** - Audio recitation support",
        inline: false,
      }
    )
    .setFooter({
      text: "🌟 This bot is constantly evolving with new features!",
    })
    .setTimestamp();
}
