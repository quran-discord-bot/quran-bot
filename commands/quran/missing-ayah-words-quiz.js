// QUIZ TYPE THREE

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  ComponentType,
} from "discord.js";
import { PrismaClient } from "../../generated/prisma/index.js";
import QuranVerses from "../../utility/QuranAPI/Verses.js";
import QuranChapters from "../../utility/QuranAPI/Chapters.js";
import QuranCanvas from "../../utility/Canvas/QuranCanvas.js";

const prisma = new PrismaClient();

export const data = new SlashCommandBuilder()
  .setName("missing-ayah-words-quiz")
  .setDescription(
    "Test your Quran knowledge - identify the missing words from a verse!"
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
        quizStatsTypeThree: true,
      },
    });

    if (!user) {
      const embed = new EmbedBuilder()
        .setTitle("🚫 Registration Required")
        .setDescription(
          "You need to register first before playing the missing words quiz!"
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

    // Check and reset daily attempts if it's a new day
    const today = new Date().toDateString();
    const lastUpdate = user.quizStatsTypeThree?.updatedAt?.toDateString();
    const isNewDay = today !== lastUpdate;

    if (isNewDay && user.quizStatsTypeThree) {
      await prisma.quranQuizTypeThreeStats.update({
        where: { userId: user.id },
        data: { attemptsToday: 0 },
      });
    }

    // Get current daily attempts and stats
    const currentStats = await prisma.quranQuizTypeThreeStats.findUnique({
      where: { userId: user.id },
    });
    const attemptsToday = isNewDay ? 0 : currentStats?.attemptsToday || 0;

    // Get random verse with sufficient length for missing words quiz
    let verse;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      verse = await quranVerses.getRandomVerse();
      attempts++;

      // Check if verse has enough words (glyph length > 13)
      if (
        verse &&
        verse.code_v2 &&
        verse.code_v2.trim().split(/\s+/).length > 13
      ) {
        break;
      }
      verse = null;
    } while (attempts < maxAttempts);

    if (!verse) {
      await interaction.editReply(
        "❌ Failed to get a suitable quiz question. Please try again."
      );
      return;
    }

    // Extract chapter info
    const correctChapterId = parseInt(verse.verse_key.split(":")[0]);
    const correctChapterData = await quranChapters.getChapterData(
      correctChapterId
    );

    // Process the verse text to create missing words quiz
    const { modifiedVerse, missingWords, missingIndices } =
      createMissingWordsQuiz(verse.code_v2.slice(0, -1));

    // Create verse image with missing parts
    const imgAttachment = canvas.createQuranImage({
      glyph: modifiedVerse,
      pages: verse.page_number,
      height: (modifiedVerse.length / 10) * 50 + 150,
    });

    const attachment = new AttachmentBuilder(imgAttachment, {
      name: "missing-words-quiz.png",
    });

    // Create buttons for number of missing words (0-4)
    const buttons = [];
    for (let i = 0; i <= 4; i++) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`missing_count_${i}`)
          .setLabel(`${i} missing words`)
          .setStyle(ButtonStyle.Primary)
      );
    }

    const components = [new ActionRowBuilder().addComponents(buttons)];

    const embed = new EmbedBuilder()
      .setTitle("🔍 Missing Words Count Quiz")
      .setDescription(
        "**How many words are missing from this verse?**\n*Look at the verse and count the missing words.*"
      )
      .setColor(0x4dabf7)
      .addFields(
        {
          name: "🎯 Instructions",
          value:
            "Click the button with the correct number of missing words. You have 30 seconds to answer!",
          inline: false,
        },
        {
          name: "🏆 Rewards",
          value: "✅ Correct: +10 XP\n❌ Wrong: -2 XP",
          inline: true,
        },
        {
          name: "📊 Today's Progress",
          value: `${attemptsToday} attempts\n${
            currentStats?.streaks || 0
          } streak`,
          inline: true,
        },
        {
          name: "📖 Chapter Info",
          value: `${
            correctChapterData.name_arabic
          }\nChapter ${correctChapterId} • Verse ${
            verse.verse_key.split(":")[1]
          }`,
          inline: true,
        },
        {
          name: "📍 Location",
          value: `Page ${verse.page_number} • Juz ${verse.juz_number}`,
          inline: true,
        }
      )
      .setImage("attachment://missing-words-quiz.png")
      .setFooter({
        text: `Level ${
          Math.floor((user.experience?.experience || 0) / 100) + 1
        } • ${user.experience?.experience || 0} XP`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    const quizMessage = await interaction.editReply({
      embeds: [embed],
      components,
      files: [attachment],
    });

    // Create collector
    const timeLimit = 60000; // 60 seconds
    const collector = quizMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: timeLimit,
      filter: (i) => i.user.id === userId,
    });

    collector.on("collect", async (componentInteraction) => {
      await componentInteraction.deferUpdate();

      // Get selected number of missing words
      const selectedCount = parseInt(
        componentInteraction.customId.split("_")[2]
      );
      const correctCount = missingWords.length;
      const isCorrect = selectedCount === correctCount;

      // Calculate XP and update stats
      const xpChange = isCorrect ? 10 : -2;
      const newXP = Math.max(0, (user.experience?.experience || 0) + xpChange);
      const newLevel = Math.floor(newXP / 100) + 1;
      const newStreak = isCorrect ? (currentStats?.streaks || 0) + 1 : 0;

      // Update database
      await prisma.userExperience.upsert({
        where: { userId: user.id },
        update: { experience: newXP },
        create: { userId: user.id, experience: newXP },
      });

      await prisma.quranQuizTypeThreeStats.upsert({
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

      // Create missing words image if there are any missing words
      const attachments = [attachment]; // Original question image

      if (missingWords.length > 0) {
        const missingWordsText = missingWords.join(" ");
        const missingWordsImageAttachment = canvas.createQuranImage({
          glyph: missingWordsText,
          pages: verse.page_number,
          height: (missingWordsText.length / 10) * 50 + 150,
          width: missingWordsText.length * 100 + 50,
        });

        const missingWordsAttachment = new AttachmentBuilder(
          missingWordsImageAttachment,
          {
            name: "missing-words-answer.png",
          }
        );

        attachments.push(missingWordsAttachment);
      }

      // Create result embed
      const resultEmbed = new EmbedBuilder()
        .setTitle(isCorrect ? "🎉 Correct!" : "❌ Incorrect!")
        .setDescription(
          isCorrect
            ? `Great job! You correctly counted **${correctCount}** missing words.`
            : `The correct answer was **${correctCount}** missing words, but you chose **${selectedCount}**.`
        )
        .setColor(isCorrect ? 0x51cf66 : 0xff6b6b)
        .addFields(
          {
            name: "❓ Original Question",
            value: "The verse with missing words shown on 1st image",
            inline: false,
          },
          {
            name: "🔍 Missing Words Answer",
            value:
              correctCount === 0
                ? "None (complete verse)"
                : `The missing words were shown on 2nd image`,
            inline: false,
          },
          {
            name: "💫 Stats Update",
            value: `${
              xpChange > 0 ? "+" : ""
            }${xpChange} XP\nTotal: ${newXP} XP (Level ${newLevel})\n🔥 Streak: ${newStreak}`,
            inline: true,
          },
          {
            name: "📊 Today's Progress",
            value: `${attemptsToday + 1} attempts`,
            inline: true,
          }
        )
        .setFooter({ text: "Play again to earn more XP!" })
        .setTimestamp();

      // Disable all buttons and highlight correct answer
      const disabledButtons = buttons.map((button, index) => {
        const newButton = ButtonBuilder.from(button);
        if (index === correctCount) {
          newButton.setStyle(ButtonStyle.Success);
        } else if (index === selectedCount && !isCorrect) {
          newButton.setStyle(ButtonStyle.Danger);
        } else {
          newButton.setStyle(ButtonStyle.Secondary);
        }
        newButton.setDisabled(true);
        return newButton;
      });

      const disabledComponents = [
        new ActionRowBuilder().addComponents(disabledButtons),
      ];

      await interaction.editReply({
        embeds: [resultEmbed],
        components: disabledComponents,
        files: attachments,
      });

      collector.stop();
    });

    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        // Timeout - apply XP penalty
        const timeoutXpPenalty = -1; // Always -1 for missing words quiz (no advanced mode penalty difference)
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

        await prisma.quranQuizTypeThreeStats.upsert({
          where: { userId: user.id },
          update: {
            attempts: { increment: 1 },
            attemptsToday: { increment: 1 },
            timeouts: { increment: 1 },
            streaks: 0,
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

        // Create missing words image for timeout response
        const attachments = [attachment]; // Original question image

        if (missingWords.length > 0) {
          const missingWordsText = missingWords.join(" ");
          const missingWordsImageAttachment = canvas.createQuranImage({
            glyph: missingWordsText,
            pages: verse.page_number,
            height: (missingWordsText.length / 10) * 50 + 150,
          });

          const missingWordsAttachment = new AttachmentBuilder(
            missingWordsImageAttachment,
            {
              name: "missing-words-answer.png",
            }
          );

          attachments.push(missingWordsAttachment);
        }

        const timeoutEmbed = new EmbedBuilder()
          .setTitle("⏰ Time's Up!")
          .setDescription(
            `Time ran out! The correct answer was **${missingWords.length}** missing words.`
          )
          .setColor(0xffa500)
          .addFields(
            {
              name: "❓ Original Question",
              value: "The verse with missing words (shown above)",
              inline: false,
            },
            {
              name: "🔍 Missing Words Answer",
              value:
                missingWords.length === 0
                  ? "None (complete verse)"
                  : `The missing words were: ${missingWords.join(" ")}${
                      missingWords.length > 0 ? " (shown below)" : ""
                    }`,
              inline: false,
            },
            {
              name: "💫 XP Penalty",
              value: `${timeoutXpPenalty} XP\nTotal: ${newXP} XP (Level ${newLevel})`,
              inline: true,
            }
          )
          .setTimestamp();

        await interaction.editReply({
          embeds: [timeoutEmbed],
          components: [],
          files: attachments,
        });
      }
    });
  } catch (error) {
    console.error("Error in missing words quiz:", error);

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

function createMissingWordsQuiz(originalText) {
  // Split the text into words (glyphs)
  const words = originalText.trim().split(/\s+/);

  // Randomly decide how many words to remove (0-4)
  const numToRemove = Math.floor(Math.random() * 5); // 0, 1, 2, 3, or 4

  if (numToRemove === 0) {
    return {
      modifiedVerse: originalText,
      missingWords: [],
      missingIndices: [],
    };
  }

  // Randomly select words to remove
  const wordsToRemove = [];
  const availableIndices = Array.from({ length: words.length }, (_, i) => i);

  for (let i = 0; i < Math.min(numToRemove, words.length); i++) {
    const randomIndex = Math.floor(Math.random() * availableIndices.length);
    const wordIndex = availableIndices.splice(randomIndex, 1)[0];
    wordsToRemove.push({ index: wordIndex, word: words[wordIndex] });
  }

  // Create modified verse with placeholders
  const modifiedWords = [...words];
  wordsToRemove.forEach(({ index }) => {
    modifiedWords[index] = "___";
  });

  const missingWords = wordsToRemove.map(({ word }) => word);
  const missingIndices = wordsToRemove.map(({ index }) => index);

  return {
    modifiedVerse: modifiedWords.join(" "),
    missingWords,
    missingIndices,
  };
}
