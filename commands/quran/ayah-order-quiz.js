// QUIZ TYPE TWO
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  ComponentType,
} from "discord.js";
import { PrismaClient } from "../../generated/prisma/index.js";
import QuranVerses from "../../utility/QuranAPI/Verses.js";
import QuranChapters from "../../utility/QuranAPI/Chapters.js";
import QuranCanvas from "../../utility/Canvas/QuranCanvas.js";

const prisma = new PrismaClient();

export const data = new SlashCommandBuilder()
  .setName("ayah-order-quiz")
  .setDescription(
    "Test your knowledge of verse order - determine if the first verse comes before or after the second!"
  );

export async function execute(interaction) {
  const quranVerses = new QuranVerses();
  const quranChapters = new QuranChapters();
  const canvas = new QuranCanvas();

  try {
    await interaction.deferReply();

    const userId = interaction.user.id;

    // Check if user is registered
    const user = await prisma.user.findUnique({
      where: { discordId: userId },
      include: {
        experience: true,
        settings: true,
        quizStatsTypeTwo: true,
      },
    });

    if (!user) {
      const embed = new EmbedBuilder()
        .setTitle("🚫 Registration Required")
        .setDescription(
          "You need to register first before playing the Ayah Order quiz!"
        )
        .setColor(0xff6b6b)
        .addFields(
          {
            name: "🎮 Why register?",
            value:
              "• Earn XP for correct answers\n• Track your quiz statistics\n• Compete on leaderboards",
            inline: false,
          },
          {
            name: "✨ How to register?",
            value:
              "Use `/register` to create your account and start earning XP!",
            inline: false,
          }
        )
        .setFooter({ text: "Registration is quick and free!" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Get a random chapter (excluding very short chapters for better quiz experience)
    const chapterId = getRandomChapterForOrderQuiz();
    const chapterData = await quranChapters.getChapterData(chapterId);

    if (!chapterData || chapterData.verses_count < 3) {
      await interaction.editReply(
        "❌ Failed to get quiz question. Please try again."
      );
      return;
    }

    // Get two random verses from the same chapter
    const { verse1, verse2, isFirstBeforeSecond } = await getTwoRandomVerses(
      chapterId,
      chapterData.verses_count,
      quranVerses
    );

    if (!verse1 || !verse2) {
      await interaction.editReply(
        "❌ Failed to get quiz verses. Please try again."
      );
      return;
    }

    // Create images for both verses
    const mergedBuffer = canvas.createDualQuranImage({
      glyph1: {
        text: verse1.code_v2.slice(0, -1),
        pages: verse1.page_number,
      },
      glyph2: {
        text: verse2.code_v2.slice(0, -1),
        pages: verse2.page_number,
      },
      height: Math.max(
        (verse1.code_v2.length / 10) * 50 +
          (verse2.code_v2.length / 10) * 50 +
          300,
        1000
      ),
    });

    const attachment1 = new AttachmentBuilder(mergedBuffer, {
      name: "quiz-verses.png",
    });

    // Create True/False buttons
    const trueButton = new ButtonBuilder()
      .setCustomId("order_quiz_true")
      .setLabel("✅ TRUE - First comes BEFORE second")
      .setStyle(ButtonStyle.Success);

    const falseButton = new ButtonBuilder()
      .setCustomId("order_quiz_false")
      .setLabel("❌ FALSE - First comes AFTER second")
      .setStyle(ButtonStyle.Danger);

    const actionRow = new ActionRowBuilder().addComponents(
      trueButton,
      falseButton
    );

    // Create quiz embed
    const embed = new EmbedBuilder()
      .setTitle("📖 Ayah Order Quiz Challenge")
      .setDescription(
        `**Chapter: ${chapterData.name_simple} (${chapterData.name_arabic})**\n\n` +
          "**Question:** Does the **FIRST verse** come **BEFORE** the **SECOND verse** in this chapter?\n\n" +
          "🔹 **First Verse** (shown in first image)\n" +
          "🔸 **Second Verse** (shown in second image)\n\n" +
          "*Look at both Arabic texts and determine if the first verse appears before the second verse in the Quran order!*"
      )
      .setColor(0x9c88ff)
      .addFields(
        {
          name: "🎯 Instructions",
          value:
            "• Study both verse images carefully\n" +
            "• Click TRUE if the first verse comes before the second in the chapter\n" +
            "• Click FALSE if the first verse comes after the second in the chapter\n" +
            "• You have 45 seconds to answer!",
          inline: false,
        },
        {
          name: "🏆 Rewards",
          value: "✅ Correct: +10 XP\n❌ Wrong: -10 XP\n⏰ Timeout: -1 XP",
          inline: true,
        },
        {
          name: "📚 Chapter Info",
          value: `${chapterData.verses_count} verses • Revealed in ${chapterData.revelation_place}`,
          inline: true,
        },
        {
          name: "📊 Today's Progress",
          value: `${attemptsToday} attempts\n${
            currentStats?.streaks || 0
          } streak`,
          inline: true,
        }
      )
      .setFooter({
        text: `Level ${user.experience?.level || 1} • ${
          user.experience?.experience || 0
        } XP`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    const quizMessage = await interaction.editReply({
      embeds: [embed],
      components: [actionRow],
      files: [attachment1],
    });

    // Create collector for button interactions
    const collector = quizMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 45000, // 45 seconds
      filter: (i) => i.user.id === userId,
    });

    collector.on("collect", async (buttonInteraction) => {
      await buttonInteraction.deferUpdate();

      const userAnsweredTrue = buttonInteraction.customId === "order_quiz_true";
      const isCorrect = userAnsweredTrue === isFirstBeforeSecond;

      // Update user experience
      let xpChange = 0;
      let newLevel = Math.floor((user.experience?.experience || 0) / 100) + 1;
      let newXP = user.experience?.experience || 0;
      let newStreak = currentStats?.streaks || 0;

      if (isCorrect) {
        xpChange = 10;
        newXP += 10;
        newStreak += 1;
        newLevel = Math.floor(newXP / 100) + 1;
      } else {
        xpChange = -10;
        newXP = Math.max(0, newXP - 10);
        newStreak = 0; // Reset streak on wrong answer
        newLevel = Math.floor(newXP / 100) + 1;
      }

      // Update database
      await prisma.userExperience.upsert({
        where: { userId: user.id },
        update: {
          experience: newXP,
        },
        create: {
          userId: user.id,
          experience: newXP,
        },
      });

      // Update quiz statistics (Type Two)
      await prisma.quranQuizTypeTwoStats.upsert({
        where: { userId: user.id },
        update: {
          attempts: { increment: 1 },
          attemptsToday: { increment: 1 },
          streaks: newStreak,
          corrects: isCorrect ? { increment: 1 } : undefined,
        },
        create: {
          userId: user.id,
          attempts: 1,
          attemptsToday: 1,
          streaks: isCorrect ? 1 : 0,
          corrects: isCorrect ? 1 : 0,
          timeouts: 0,
        },
      });

      // Create result embed
      const resultEmbed = new EmbedBuilder()
        .setTitle(isCorrect ? "🎉 Correct!" : "❌ Incorrect!")
        .setDescription(
          isCorrect
            ? `Excellent! You correctly identified the verse order.`
            : `The correct answer was **${
                isFirstBeforeSecond ? "TRUE" : "FALSE"
              }**.`
        )
        .setColor(isCorrect ? 0x51cf66 : 0xff6b6b)
        .addFields(
          {
            name: "📍 Correct Order",
            value:
              `**First verse:** ${verse1.verse_key} (Page ${verse1.page_number})\n` +
              `**Second verse:** ${verse2.verse_key} (Page ${verse2.page_number})\n\n` +
              `The first verse ${
                isFirstBeforeSecond ? "**comes before**" : "**comes after**"
              } the second verse.`,
            inline: false,
          },
          {
            name: "📖 Chapter Details",
            value:
              `**${chapterData.name_arabic}** (${chapterData.name_simple})\n` +
              `Chapter ${chapterId} • ${chapterData.verses_count} verses\n` +
              `Revealed in ${chapterData.revelation_place}`,
            inline: false,
          },
          {
            name: "💫 Stats Update",
            value:
              `${xpChange > 0 ? "+" : ""}${xpChange} XP\n` +
              `Total: ${newXP} XP (Level ${newLevel})\n🔥 Streak: ${newStreak}`,
            inline: true,
          },
          {
            name: "📊 Today's Progress",
            value: `${attemptsToday + 1} attempts`,
            inline: true,
          }
        )
        .setFooter({
          text: "Play again with /ayah-order-quiz to earn more XP!",
        })
        .setTimestamp();

      // Disable all buttons and update their styles
      const disabledTrueButton = new ButtonBuilder()
        .setCustomId("order_quiz_true")
        .setLabel("✅ TRUE - First comes BEFORE second")
        .setStyle(
          isFirstBeforeSecond ? ButtonStyle.Success : ButtonStyle.Secondary
        )
        .setDisabled(true);

      const disabledFalseButton = new ButtonBuilder()
        .setCustomId("order_quiz_false")
        .setLabel("❌ FALSE - First comes AFTER second")
        .setStyle(
          !isFirstBeforeSecond ? ButtonStyle.Success : ButtonStyle.Secondary
        )
        .setDisabled(true);

      // Highlight user's choice if wrong
      if (!isCorrect) {
        if (userAnsweredTrue) {
          disabledTrueButton.setStyle(ButtonStyle.Danger);
        } else {
          disabledFalseButton.setStyle(ButtonStyle.Danger);
        }
      }

      const disabledRow = new ActionRowBuilder().addComponents(
        disabledTrueButton,
        disabledFalseButton
      );

      await interaction.editReply({
        embeds: [resultEmbed],
        components: [disabledRow],
        files: [attachment1],
      });

      collector.stop();
    });

    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        // Timeout - apply XP penalty and update stats
        const timeoutXpPenalty = -1;
        const newXP = Math.max(
          0,
          (user.experience?.experience || 0) + timeoutXpPenalty
        );
        const newLevel = Math.floor(newXP / 100) + 1;

        // Update user experience with timeout penalty
        await prisma.userExperience.upsert({
          where: { userId: user.id },
          update: {
            experience: newXP,
          },
          create: {
            userId: user.id,
            experience: newXP,
          },
        });

        // Update timeout stats
        await prisma.quranQuizTypeTwoStats.upsert({
          where: { userId: user.id },
          update: {
            attempts: { increment: 1 },
            attemptsToday: { increment: 1 },
            timeouts: { increment: 1 },
            streaks: 0, // Reset streak on timeout
          },
          create: {
            userId: user.id,
            attempts: 1,
            attemptsToday: 1,
            corrects: 0,
            timeouts: 1,
            streaks: 0,
          },
        });

        // Timeout - no answer given
        const timeoutEmbed = new EmbedBuilder()
          .setTitle("⏰ Time's Up!")
          .setDescription(
            `Time ran out! The correct answer was **${
              isFirstBeforeSecond ? "TRUE" : "FALSE"
            }**.`
          )
          .setColor(0xffa500)
          .addFields(
            {
              name: "📍 Correct Order",
              value:
                `**First verse:** ${verse1.verse_key} (Page ${verse1.page_number})\n` +
                `**Second verse:** ${verse2.verse_key} (Page ${verse2.page_number})\n\n` +
                `The first verse ${
                  isFirstBeforeSecond ? "**comes before**" : "**comes after**"
                } the second verse.`,
              inline: false,
            },
            {
              name: "💫 XP Penalty",
              value: `${timeoutXpPenalty} XP\nTotal: ${newXP} XP (Level ${newLevel})`,
              inline: true,
            },
            {
              name: "💡 Try Again",
              value: "Use `/ayah-order-quiz` to test your knowledge again!",
              inline: false,
            }
          )
          .setTimestamp();

        // Disable all buttons and show correct answer
        const disabledTrueButton = new ButtonBuilder()
          .setCustomId("order_quiz_true")
          .setLabel("✅ TRUE - First comes BEFORE second")
          .setStyle(
            isFirstBeforeSecond ? ButtonStyle.Success : ButtonStyle.Secondary
          )
          .setDisabled(true);

        const disabledFalseButton = new ButtonBuilder()
          .setCustomId("order_quiz_false")
          .setLabel("❌ FALSE - First comes AFTER second")
          .setStyle(
            !isFirstBeforeSecond ? ButtonStyle.Success : ButtonStyle.Secondary
          )
          .setDisabled(true);

        const disabledRow = new ActionRowBuilder().addComponents(
          disabledTrueButton,
          disabledFalseButton
        );

        await interaction.editReply({
          embeds: [timeoutEmbed],
          components: [disabledRow],
          files: [attachment1],
        });
      }
    });
  } catch (error) {
    console.error("Error in ayah order quiz:", error);

    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Quiz Error")
      .setDescription("Failed to load quiz question. Please try again later.")
      .setColor(0xff6b6b)
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  } finally {
    await quranVerses.disconnect();
    await quranChapters.disconnect();
    await prisma.$disconnect();
  }
}

// Helper function to get a random chapter suitable for order quiz
function getRandomChapterForOrderQuiz() {
  // Exclude very short chapters (less than 5 verses) for better quiz experience
  const suitableChapters = [];

  // Chapter verse counts (approximate for filtering)
  const chapterVerseCounts = {
    1: 7,
    2: 286,
    3: 200,
    4: 176,
    5: 120,
    6: 165,
    7: 206,
    8: 75,
    9: 129,
    10: 109,
    11: 123,
    12: 111,
    13: 43,
    14: 52,
    15: 99,
    16: 128,
    17: 111,
    18: 110,
    19: 98,
    20: 135,
    21: 112,
    22: 78,
    23: 118,
    24: 64,
    25: 77,
    26: 227,
    27: 93,
    28: 88,
    29: 69,
    30: 60,
    31: 34,
    32: 30,
    33: 73,
    34: 54,
    35: 45,
    36: 83,
    37: 182,
    38: 88,
    39: 75,
    40: 85,
    41: 54,
    42: 53,
    43: 89,
    44: 59,
    45: 37,
    46: 35,
    47: 38,
    48: 29,
    49: 18,
    50: 45,
    51: 60,
    52: 49,
    53: 62,
    54: 55,
    55: 78,
    56: 96,
    57: 29,
    58: 22,
    59: 24,
    60: 13,
    61: 14,
    62: 11,
    63: 11,
    64: 18,
    65: 12,
    66: 12,
    67: 30,
    68: 52,
    69: 52,
    70: 44,
    71: 28,
    72: 28,
    73: 20,
    74: 56,
    75: 40,
    76: 31,
    77: 50,
    78: 40,
    79: 46,
    80: 42,
    81: 29,
    82: 19,
    83: 36,
    84: 25,
    85: 22,
    86: 17,
    87: 19,
    88: 26,
    89: 30,
    90: 20,
    91: 15,
    92: 21,
    93: 11,
    94: 8,
    95: 8,
    96: 19,
    97: 5,
    98: 8,
    99: 8,
    100: 11,
    101: 11,
    102: 8,
    103: 3,
    104: 9,
    105: 5,
    106: 4,
    107: 7,
    108: 3,
    109: 6,
    110: 3,
    111: 5,
    112: 4,
    113: 5,
    114: 6,
  };

  // Add chapters with at least 10 verses
  for (let i = 1; i <= 114; i++) {
    if (chapterVerseCounts[i] >= 10) {
      suitableChapters.push(i);
    }
  }

  // Return random suitable chapter
  return suitableChapters[Math.floor(Math.random() * suitableChapters.length)];
}

// Helper function to get two random verses from the same chapter
async function getTwoRandomVerses(chapterId, totalVerses, quranVerses) {
  try {
    // Generate two different random verse numbers
    let verse1Number, verse2Number;

    do {
      verse1Number = Math.floor(Math.random() * totalVerses) + 1;
      verse2Number = Math.floor(Math.random() * totalVerses) + 1;
    } while (verse1Number === verse2Number);

    // Get both verses
    const verse1Promise = quranVerses.getVerseByKey(
      `${chapterId}:${verse1Number}`
    );
    const verse2Promise = quranVerses.getVerseByKey(
      `${chapterId}:${verse2Number}`
    );

    const [verse1, verse2] = await Promise.all([verse1Promise, verse2Promise]);

    // The question is: "Does the FIRST verse come BEFORE the SECOND verse?"
    // Answer is TRUE if verse1Number < verse2Number, FALSE otherwise
    const isFirstBeforeSecond = verse1Number < verse2Number;

    return {
      verse1,
      verse2,
      isFirstBeforeSecond,
    };
  } catch (error) {
    console.error("Error getting two random verses:", error);
    return {
      verse1: null,
      verse2: null,
      isFirstBeforeSecond: false,
    };
  }
}
