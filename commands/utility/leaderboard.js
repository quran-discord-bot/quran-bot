import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { PrismaClient } from "../../generated/prisma/index.js";

const prisma = new PrismaClient();

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("View the experience leaderboard")
  .addStringOption((option) =>
    option
      .setName("type")
      .setDescription("Type of leaderboard to view")
      .setRequired(false)
      .addChoices(
        { name: "Experience", value: "experience" },
        { name: "Quiz Type 1", value: "quiz1" },
        { name: "Quiz Type 2", value: "quiz2" },
        { name: "Quiz Type 3", value: "quiz3" }
      )
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const leaderboardType =
      interaction.options.getString("type") || "experience";
    const userId = interaction.user.id;

    let leaderboardData;
    let userPosition = null;
    let title;
    let description;

    switch (leaderboardType) {
      case "experience":
        leaderboardData = await getExperienceLeaderboard();
        userPosition = await getUserExperiencePosition(userId);
        title = "🏆 Experience Leaderboard";
        description = "Top users ranked by total experience points";
        break;

      case "quiz1":
        leaderboardData = await getQuizTypeOneLeaderboard();
        userPosition = await getUserQuizTypeOnePosition(userId);
        title = "🧩 Quiz Type 1 Leaderboard";
        description = "Top users ranked by Quiz Type 1 accuracy";
        break;

      case "quiz2":
        leaderboardData = await getQuizTypeTwoLeaderboard();
        userPosition = await getUserQuizTypeTwoPosition(userId);
        title = "🎯 Quiz Type 2 Leaderboard";
        description = "Top users ranked by Quiz Type 2 accuracy";
        break;

      case "quiz3":
        leaderboardData = await getQuizTypeThreeLeaderboard();
        userPosition = await getUserQuizTypeThreePosition(userId);
        title = "🔍 Quiz Type 3 Leaderboard";
        description = "Top users ranked by Missing Words Quiz accuracy";
        break;
    }

    if (!leaderboardData || leaderboardData.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle("📊 Empty Leaderboard")
        .setDescription("No users found on the leaderboard yet!")
        .setColor(0xffa500)
        .addFields({
          name: "🎮 Get Started",
          value: "Use `/register` to create an account and start earning XP!",
          inline: false,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = await createLeaderboardEmbed(
      leaderboardData,
      userPosition,
      title,
      description,
      leaderboardType,
      1
    );

    // Create navigation buttons if there are more than 10 users
    const totalUsers = await getTotalUsers(leaderboardType);
    const components =
      totalUsers > 10
        ? [createNavigationButtons(1, Math.ceil(totalUsers / 10))]
        : [];

    const response = await interaction.editReply({
      embeds: [embed],
      components,
    });

    // Handle pagination if there are multiple pages
    if (components.length > 0) {
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000, // 5 minutes
        filter: (i) => i.user.id === userId,
      });

      collector.on("collect", async (buttonInteraction) => {
        await buttonInteraction.deferUpdate();

        const action = buttonInteraction.customId;
        let currentPage = parseInt(action.split("_")[1]);

        if (action.startsWith("prev_")) {
          currentPage = Math.max(1, currentPage - 1);
        } else if (action.startsWith("next_")) {
          currentPage = Math.min(Math.ceil(totalUsers / 10), currentPage + 1);
        }

        const pageData = await getLeaderboardPage(leaderboardType, currentPage);
        const pageEmbed = await createLeaderboardEmbed(
          pageData,
          userPosition,
          title,
          description,
          leaderboardType,
          currentPage
        );

        const newComponents = [
          createNavigationButtons(currentPage, Math.ceil(totalUsers / 10)),
        ];

        await buttonInteraction.editReply({
          embeds: [pageEmbed],
          components: newComponents,
        });
      });

      collector.on("end", async () => {
        try {
          const disabledComponents = components.map((row) => {
            const newRow = new ActionRowBuilder();
            row.components.forEach((component) => {
              const newButton = ButtonBuilder.from(component).setDisabled(true);
              newRow.addComponents(newButton);
            });
            return newRow;
          });

          await interaction.editReply({ components: disabledComponents });
        } catch (error) {
          // Ignore errors when disabling components (message might be deleted)
        }
      });
    }
  } catch (error) {
    console.error("Error in leaderboard command:", error);

    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Leaderboard Error")
      .setDescription("Failed to load leaderboard. Please try again later.")
      .setColor(0xff6b6b)
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  } finally {
    await prisma.$disconnect();
  }
}

async function getExperienceLeaderboard(page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  return await prisma.user.findMany({
    include: {
      experience: true,
    },
    where: {
      experience: {
        isNot: null,
      },
    },
    orderBy: {
      experience: {
        experience: "desc",
      },
    },
    skip,
    take: limit,
  });
}

async function getQuizTypeOneLeaderboard(page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  return await prisma.user.findMany({
    include: {
      quizStatsTypeOne: true,
    },
    where: {
      quizStatsTypeOne: {
        attempts: {
          gt: 0,
        },
      },
    },
    orderBy: [
      {
        quizStatsTypeOne: {
          corrects: "desc",
        },
      },
      {
        quizStatsTypeOne: {
          attempts: "asc",
        },
      },
    ],
    skip,
    take: limit,
  });
}

async function getQuizTypeTwoLeaderboard(page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  return await prisma.user.findMany({
    include: {
      quizStatsTypeTwo: true,
    },
    where: {
      quizStatsTypeTwo: {
        attempts: {
          gt: 0,
        },
      },
    },
    orderBy: [
      {
        quizStatsTypeTwo: {
          corrects: "desc",
        },
      },
      {
        quizStatsTypeTwo: {
          attempts: "asc",
        },
      },
    ],
    skip,
    take: limit,
  });
}

async function getQuizTypeThreeLeaderboard(page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  return await prisma.user.findMany({
    include: {
      quizStatsTypeThree: true,
    },
    where: {
      quizStatsTypeThree: {
        attempts: {
          gt: 0,
        },
      },
    },
    orderBy: [
      {
        quizStatsTypeThree: {
          corrects: "desc",
        },
      },
      {
        quizStatsTypeThree: {
          attempts: "asc",
        },
      },
    ],
    skip,
    take: limit,
  });
}

async function getLeaderboardPage(type, page) {
  switch (type) {
    case "experience":
      return await getExperienceLeaderboard(page);
    case "quiz1":
      return await getQuizTypeOneLeaderboard(page);
    case "quiz2":
      return await getQuizTypeTwoLeaderboard(page);
    case "quiz3":
      return await getQuizTypeThreeLeaderboard(page);
    default:
      return await getExperienceLeaderboard(page);
  }
}

async function getUserExperiencePosition(discordId) {
  const user = await prisma.user.findUnique({
    where: { discordId },
    include: { experience: true },
  });

  if (!user || !user.experience) return null;

  const higherRanked = await prisma.user.count({
    where: {
      experience: {
        experience: {
          gt: user.experience.experience,
        },
      },
    },
  });

  return {
    position: higherRanked + 1,
    user,
  };
}

async function getUserQuizTypeOnePosition(discordId) {
  const user = await prisma.user.findUnique({
    where: { discordId },
    include: { quizStatsTypeOne: true },
  });

  if (!user || !user.quizStatsTypeOne) return null;

  const higherRanked = await prisma.user.count({
    where: {
      quizStatsTypeOne: {
        corrects: {
          gt: user.quizStatsTypeOne.corrects,
        },
      },
    },
  });

  return {
    position: higherRanked + 1,
    user,
  };
}

async function getUserQuizTypeTwoPosition(discordId) {
  const user = await prisma.user.findUnique({
    where: { discordId },
    include: { quizStatsTypeTwo: true },
  });

  if (!user || !user.quizStatsTypeTwo) return null;

  const higherRanked = await prisma.user.count({
    where: {
      quizStatsTypeTwo: {
        corrects: {
          gt: user.quizStatsTypeTwo.corrects,
        },
      },
    },
  });

  return {
    position: higherRanked + 1,
    user,
  };
}

async function getUserQuizTypeThreePosition(discordId) {
  const user = await prisma.user.findUnique({
    where: { discordId },
    include: { quizStatsTypeThree: true },
  });

  if (!user || !user.quizStatsTypeThree) return null;

  const higherRanked = await prisma.user.count({
    where: {
      quizStatsTypeThree: {
        corrects: {
          gt: user.quizStatsTypeThree.corrects,
        },
      },
    },
  });

  return {
    position: higherRanked + 1,
    user,
  };
}

async function getTotalUsers(type) {
  switch (type) {
    case "experience":
      return await prisma.user.count({
        where: {
          experience: {
            isNot: null,
          },
        },
      });
    case "quiz1":
      return await prisma.user.count({
        where: {
          quizStatsTypeOne: {
            attempts: {
              gt: 0,
            },
          },
        },
      });
    case "quiz2":
      return await prisma.user.count({
        where: {
          quizStatsTypeTwo: {
            attempts: {
              gt: 0,
            },
          },
        },
      });
    case "quiz3":
      return await prisma.user.count({
        where: {
          quizStatsTypeThree: {
            attempts: {
              gt: 0,
            },
          },
        },
      });
    default:
      return 0;
  }
}

async function createLeaderboardEmbed(
  data,
  userPosition,
  title,
  description,
  type,
  page
) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0x4dabf7)
    .setTimestamp();

  let leaderboardText = "";
  const startRank = (page - 1) * 10;

  for (let i = 0; i < data.length; i++) {
    const user = data[i];
    const rank = startRank + i + 1;
    const medal = rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : `${rank}.`;

    let userInfo = "";

    if (type === "experience") {
      const level = Math.floor((user.experience?.experience || 0) / 100) + 1;
      const xp = user.experience?.experience || 0;
      userInfo = `Level ${level} • ${xp.toLocaleString()} XP`;
    } else if (type === "quiz1") {
      const stats = user.quizStatsTypeOne;
      const accuracy =
        stats.attempts > 0
          ? ((stats.corrects / stats.attempts) * 100).toFixed(1)
          : 0;
      userInfo = `${stats.corrects}/${stats.attempts} • ${accuracy}% accuracy`;
    } else if (type === "quiz2") {
      const stats = user.quizStatsTypeTwo;
      const accuracy =
        stats.attempts > 0
          ? ((stats.corrects / stats.attempts) * 100).toFixed(1)
          : 0;
      userInfo = `${stats.corrects}/${stats.attempts} • ${accuracy}% accuracy`;
    } else if (type === "quiz3") {
      const stats = user.quizStatsTypeThree;
      const accuracy =
        stats.attempts > 0
          ? ((stats.corrects / stats.attempts) * 100).toFixed(1)
          : 0;
      userInfo = `${stats.corrects}/${stats.attempts} • ${accuracy}% accuracy`;
    }

    leaderboardText += `${medal} <@${user.discordId}>\n${userInfo}\n\n`;
  }

  embed.addFields({
    name: `📊 Rankings (Page ${page})`,
    value: leaderboardText || "No data available",
    inline: false,
  });

  // Add user's position if they're not in the top 10 on page 1
  if (userPosition && page === 1 && userPosition.position > 10) {
    let userInfo = "";

    if (type === "experience") {
      const level =
        Math.floor((userPosition.user.experience?.experience || 0) / 100) + 1;
      const xp = userPosition.user.experience?.experience || 0;
      userInfo = `Level ${level} • ${xp.toLocaleString()} XP`;
    } else if (type === "quiz1") {
      const stats = userPosition.user.quizStatsTypeOne;
      const accuracy =
        stats.attempts > 0
          ? ((stats.corrects / stats.attempts) * 100).toFixed(1)
          : 0;
      userInfo = `${stats.corrects}/${stats.attempts} • ${accuracy}% accuracy`;
    } else if (type === "quiz2") {
      const stats = userPosition.user.quizStatsTypeTwo;
      const accuracy =
        stats.attempts > 0
          ? ((stats.corrects / stats.attempts) * 100).toFixed(1)
          : 0;
      userInfo = `${stats.corrects}/${stats.attempts} • ${accuracy}% accuracy`;
    } else if (type === "quiz3") {
      const stats = userPosition.user.quizStatsTypeThree;
      const accuracy =
        stats.attempts > 0
          ? ((stats.corrects / stats.attempts) * 100).toFixed(1)
          : 0;
      userInfo = `${stats.corrects}/${stats.attempts} • ${accuracy}% accuracy`;
    }

    embed.addFields({
      name: "📍 Your Position",
      value: `${userPosition.position}. <@${userPosition.user.discordId}>\n${userInfo}`,
      inline: false,
    });
  }

  return embed;
}

function createNavigationButtons(currentPage, totalPages) {
  const row = new ActionRowBuilder();

  const prevButton = new ButtonBuilder()
    .setCustomId(`prev_${currentPage}`)
    .setLabel("◀ Previous")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage <= 1);

  const pageButton = new ButtonBuilder()
    .setCustomId(`page_${currentPage}`)
    .setLabel(`Page ${currentPage}/${totalPages}`)
    .setStyle(ButtonStyle.Primary)
    .setDisabled(true);

  const nextButton = new ButtonBuilder()
    .setCustomId(`next_${currentPage}`)
    .setLabel("Next ▶")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage >= totalPages);

  row.addComponents(prevButton, pageButton, nextButton);
  return row;
}
