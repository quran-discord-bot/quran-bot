import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { PrismaClient } from "../../generated/prisma/index.js";

const prisma = new PrismaClient();

export const data = new SlashCommandBuilder()
  .setName("quiz-stats")
  .setDescription("View detailed Quran quiz statistics and performance")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("View another user's quiz statistics (optional)")
      .setRequired(false)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser("user");
    const userId = targetUser ? targetUser.id : interaction.user.id;
    const isViewingOwnStats =
      !targetUser || targetUser.id === interaction.user.id;

    // Get user with all quiz stats
    const user = await prisma.user.findUnique({
      where: { discordId: userId },
      include: {
        experience: true,
        quizStatsTypeOne: true,
        quizStatsTypeTwo: true,
        quizStatsTypeThree: true,
        quizStatsTypeFour: true,
      },
    });

    if (!user) {
      const embed = new EmbedBuilder()
        .setTitle("🚫 User Not Found")
        .setDescription(
          isViewingOwnStats
            ? "You need to register first to view your quiz statistics!"
            : `${targetUser.displayName} is not registered yet.`
        )
        .setColor(0xff6b6b)
        .addFields({
          name: "✨ How to register?",
          value:
            "Use `/register` to create your account and start tracking your quiz performance!",
          inline: false,
        })
        .setFooter({ text: "Registration is quick and free!" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Get current level and XP
    const currentXP = user.experience?.experience || 0;
    const currentLevel = Math.floor(currentXP / 100) + 1;
    const xpForNextLevel = currentLevel * 100 - currentXP;

    // Type One Stats (Chapter Identification Quiz)
    const typeOneStats = user.quizStatsTypeOne;
    const typeOneAttempts = typeOneStats?.attempts || 0;
    const typeOneCorrects = typeOneStats?.corrects || 0;
    const typeOneTimeouts = typeOneStats?.timeouts || 0;
    const typeOneAccuracy =
      typeOneAttempts > 0
        ? ((typeOneCorrects / typeOneAttempts) * 100).toFixed(1)
        : "0.0";

    // Type Two Stats (Ayah Order Quiz)
    const typeTwoStats = user.quizStatsTypeTwo;
    const typeTwoAttempts = typeTwoStats?.attempts || 0;
    const typeTwoCorrects = typeTwoStats?.corrects || 0;
    const typeTwoTimeouts = typeTwoStats?.timeouts || 0;
    const typeTwoAccuracy =
      typeTwoAttempts > 0
        ? ((typeTwoCorrects / typeTwoAttempts) * 100).toFixed(1)
        : "0.0";

    // Type Three Stats (Missing Words Quiz)
    const typeThreeStats = user.quizStatsTypeThree;
    const typeThreeAttempts = typeThreeStats?.attempts || 0;
    const typeThreeCorrects = typeThreeStats?.corrects || 0;
    const typeThreeTimeouts = typeThreeStats?.timeouts || 0;
    const typeThreeAccuracy =
      typeThreeAttempts > 0
        ? ((typeThreeCorrects / typeThreeAttempts) * 100).toFixed(1)
        : "0.0";

    // Type Four Stats (Translation Quiz)
    const typeFourStats = user.quizStatsTypeFour;
    const typeFourAttempts = typeFourStats?.attempts || 0;
    const typeFourCorrects = typeFourStats?.corrects || 0;
    const typeFourTimeouts = typeFourStats?.timeouts || 0;
    const typeFourAccuracy =
      typeFourAttempts > 0
        ? ((typeFourCorrects / typeFourAttempts) * 100).toFixed(1)
        : "0.0";

    // Overall Stats
    const totalAttempts =
      typeOneAttempts + typeTwoAttempts + typeThreeAttempts + typeFourAttempts;
    const totalCorrects =
      typeOneCorrects + typeTwoCorrects + typeThreeCorrects + typeFourCorrects;
    const totalTimeouts =
      typeOneTimeouts + typeTwoTimeouts + typeThreeTimeouts + typeFourTimeouts;
    const overallAccuracy =
      totalAttempts > 0
        ? ((totalCorrects / totalAttempts) * 100).toFixed(1)
        : "0.0";

    // Determine user's skill level based on performance
    let skillLevel = "Beginner 🌱";
    let skillColor = 0x95d5b2;

    if (totalAttempts >= 50 && overallAccuracy >= 80) {
      skillLevel = "Master 👑";
      skillColor = 0xffd700;
    } else if (totalAttempts >= 30 && overallAccuracy >= 70) {
      skillLevel = "Expert 🔥";
      skillColor = 0xff6b6b;
    } else if (totalAttempts >= 20 && overallAccuracy >= 60) {
      skillLevel = "Advanced ⭐";
      skillColor = 0x4dabf7;
    } else if (totalAttempts >= 10 && overallAccuracy >= 50) {
      skillLevel = "Intermediate 📚";
      skillColor = 0x9c88ff;
    }

    const displayUser = targetUser || interaction.user;
    const embed = new EmbedBuilder()
      .setTitle("📊 Quiz Statistics Dashboard")
      .setDescription(
        `**${displayUser.displayName}'s Quran Quiz Performance**\n` +
          `*Skill Level: ${skillLevel}*`
      )
      .setColor(skillColor)
      .addFields(
        {
          name: "🎯 Overall Performance",
          value:
            `**Total Attempts:** ${totalAttempts}\n` +
            `**Correct Answers:** ${totalCorrects}\n` +
            `**Timeouts:** ${totalTimeouts}\n` +
            `**Accuracy Rate:** ${overallAccuracy}%`,
          inline: false,
        },
        {
          name: "🧩 Chapter Quiz",
          value:
            typeOneAttempts > 0
              ? `**Attempts:** ${typeOneAttempts}\n` +
                `**Correct:** ${typeOneCorrects}\n` +
                `**Accuracy:** ${typeOneAccuracy}%`
              : "No attempts yet",
          inline: true,
        },
        {
          name: "📖 Order Quiz",
          value:
            typeTwoAttempts > 0
              ? `**Attempts:** ${typeTwoAttempts}\n` +
                `**Correct:** ${typeTwoCorrects}\n` +
                `**Accuracy:** ${typeTwoAccuracy}%`
              : "No attempts yet",
          inline: true,
        },
        {
          name: "🔍 Missing Words",
          value:
            typeThreeAttempts > 0
              ? `**Attempts:** ${typeThreeAttempts}\n` +
                `**Correct:** ${typeThreeCorrects}\n` +
                `**Accuracy:** ${typeThreeAccuracy}%`
              : "No attempts yet",
          inline: true,
        },
        {
          name: "🌟 Translation Quiz",
          value:
            typeFourAttempts > 0
              ? `**Attempts:** ${typeFourAttempts}\n` +
                `**Correct:** ${typeFourCorrects}\n` +
                `**Accuracy:** ${typeFourAccuracy}%`
              : "No attempts yet",
          inline: true,
        },
        {
          name: "💫 Experience & Level",
          value:
            `**Current Level:** ${currentLevel}\n` +
            `**Total XP:** ${currentXP}\n` +
            (isViewingOwnStats
              ? `**XP to Next Level:** ${xpForNextLevel}`
              : ""),
          inline: false,
        }
      )
      .setFooter({
        text: `Account created: ${user.createdAt.toDateString()}`,
        iconURL: displayUser.displayAvatarURL(),
      })
      .setTimestamp();

    // Add performance tips only for viewing own stats
    if (totalAttempts > 0 && isViewingOwnStats) {
      let tips = "";

      if (overallAccuracy < 50) {
        tips =
          "💡 **Tip:** Practice more to improve accuracy! Try reviewing chapter names and verse orders.";
      } else if (overallAccuracy < 70) {
        tips =
          "💡 **Tip:** You're making good progress! Focus on chapters you find challenging.";
      } else if (overallAccuracy < 90) {
        tips =
          "💡 **Tip:** Excellent work! You're becoming a Quran knowledge expert!";
      } else {
        tips =
          "💡 **Tip:** Outstanding mastery! Consider helping others learn the Quran.";
      }

      if (totalTimeouts > totalAttempts * 0.2) {
        tips += "\n⏱️ **Note:** Try to answer faster to avoid timeouts.";
      }

      embed.addFields({
        name: "🎓 Performance Insights",
        value: tips,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in quiz stats command:", error);

    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Stats Error")
      .setDescription("Failed to load quiz statistics. Please try again later.")
      .setColor(0xff6b6b)
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  } finally {
    await prisma.$disconnect();
  }
}
