// QUIZ TYPE FOUR - Translation Quiz

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
import QuranTranslations from "../../utility/QuranAPI/Translate.js";

const prisma = new PrismaClient();

export const data = new SlashCommandBuilder()
  .setName("quiz-ayah-translation")
  .setDescription(
    "Test your knowledge of Quran translations - identify the correct translation!"
  );

export async function execute(interaction) {
  const quranVerses = new QuranVerses();
  const quranChapters = new QuranChapters();
  const canvas = new QuranCanvas();
  const translations = new QuranTranslations();

  try {
    // Check if interaction is already acknowledged
    if (interaction.replied || interaction.deferred) {
      console.log("Interaction already acknowledged, skipping defer");
    } else {
      await interaction.deferReply();
    }

    const userId = interaction.user.id;

    // Check if user is registered
    const user = await prisma.user.findUnique({
      where: { discordId: userId },
      include: {
        experience: true,
        settings: true,
        quizQueue: true,
        quizStatsTypeFour: true,
      },
    });

    if (!user) {
      await safeEditReply(interaction, {
        content:
          "🚫 **Registration Required**\n\nYou need to register first before playing the translation quiz!\n\n🎮 **Why register?**\n• Earn XP for correct answers\n• Track your quiz statistics\n• Compete on leaderboards\n\n✨ Use `/register` to create your account and start earning XP!",
      });
      return;
    }

    // Check if user is already in queue
    if (user.quizQueue) {
      // Apply XP penalty for trying to use command while in queue
      const penaltyXP = -3;
      const newXP = Math.max(0, (user.experience?.experience || 0) + penaltyXP);

      try {
        await prisma.userExperience.upsert({
          where: { userId: user.id },
          update: { experience: newXP },
          create: { userId: user.id, experience: newXP },
        });
      } catch (dbError) {
        console.error("Database penalty update error:", dbError.message);
      }

      await safeEditReply(interaction, {
        content: `🚫 **Command Cooldown Active**\n\nYou're currently in the quiz queue. Please wait before using this command again.\n\n💔 **XP Penalty:** -3 XP\n**Total XP:** ${newXP}\n\n⏰ Try again in a few moments!`,
      });
      return;
    }

    // Add user to queue
    try {
      await prisma.quranQuizQueue.create({
        data: {
          userId: user.id,
        },
      });
    } catch (queueError) {
      console.error("Error adding user to queue:", queueError.message);
    }

    // Get random verse with longer glyph (>20 characters)
    let verse;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      verse = await quranVerses.getRandomVerse();
      attempts++;
    } while (
      verse &&
      verse.code_v2 &&
      verse.code_v2.length <= 20 &&
      attempts < maxAttempts
    );

    if (!verse || (verse.code_v2 && verse.code_v2.length <= 20)) {
      await safeEditReply(interaction, {
        content: "❌ Failed to get a suitable quiz question. Please try again.",
      });
      return;
    }

    // Extract chapter info
    const correctChapterId = parseInt(verse.verse_key.split(":")[0]);
    const correctChapterData = await quranChapters.getChapterData(
      correctChapterId
    );

    // Get the correct translation (Sahih International)
    const correctTranslationResponse = await translations.getTranslationByAyah(
      20,
      verse.verse_key
    );

    if (
      !correctTranslationResponse.translations ||
      correctTranslationResponse.translations.length === 0
    ) {
      await safeEditReply(interaction, {
        content:
          "❌ Failed to get translation for this verse. Please try again.",
      });
      return;
    }

    const correctTranslation = correctTranslationResponse.translations[0];

    // Generate wrong translations from the same chapter
    const wrongTranslations = await generateSameChapterTranslations(
      correctTranslation.text,
      verse.verse_key,
      correctChapterId,
      translations
    );

    if (wrongTranslations.length < 4) {
      await safeEditReply(interaction, {
        content: "❌ Failed to generate quiz options. Please try again.",
      });
      return;
    }

    // Clean HTML tags from all translations
    const cleanedCorrectTranslation = cleanHtmlTags(correctTranslation.text);
    const cleanedWrongTranslations = wrongTranslations
      .slice(0, 4)
      .map((text) => cleanHtmlTags(text));

    // Randomly decide if the correct answer should be included (70% chance it's included)
    const includeCorrectAnswer = Math.random() < 0.7;

    let shuffledChoices;
    let correctIndex;
    let correctTranslationText = cleanedCorrectTranslation;

    if (includeCorrectAnswer) {
      // Include correct translation: randomly select 3 wrong + 1 correct + "None of the above"
      const selectedWrong = shuffleArray(cleanedWrongTranslations).slice(0, 3);
      const allTranslations = [cleanedCorrectTranslation, ...selectedWrong];
      const slicedTranslations = sliceTranslationsToSimilarLength(
        allTranslations,
        user.quizStatsTypeFour?.attemptsToday || 10
      );

      // Create final choices: 3 wrong + 1 correct + "None of the above"
      const finalChoices = [
        ...slicedTranslations.slice(1),
        slicedTranslations[0],
        "None of the above",
      ];
      shuffledChoices = shuffleArray(finalChoices);
      correctIndex = shuffledChoices.indexOf(slicedTranslations[0]); // Find where correct translation ended up
      correctTranslationText = slicedTranslations[0]; // Update to sliced version
    } else {
      // Don't include correct translation: 4 wrong + "None of the above" (none of the above is correct)
      const slicedWrongChoices = sliceTranslationsToSimilarLength(
        cleanedWrongTranslations,
        user.quizStatsTypeFour?.attemptsToday || 10
      );
      const finalChoices = [...slicedWrongChoices, "None of the above"];
      shuffledChoices = shuffleArray(finalChoices);
      correctIndex = shuffledChoices.indexOf("None of the above");
    }

    // Create verse image
    const imgAttachment = canvas.createQuranImage({
      glyph: verse.code_v2.slice(0, -1),
      pages: verse.page_number,
      height: (verse.code_v2.length / 10) * 50 + 150,
    });

    const attachment = new AttachmentBuilder(imgAttachment, {
      name: "translation-quiz-verse.png",
    });

    // Create buttons for choices (now 4 buttons A, B, C, D)
    const buttons = shuffledChoices.map((choice, index) =>
      new ButtonBuilder()
        .setCustomId(`translation_answer_${index}`)
        .setLabel(`${String.fromCharCode(65 + index)}`) // A, B, C, D
        .setStyle(ButtonStyle.Primary)
    );

    const components = [new ActionRowBuilder().addComponents(buttons)];
    const timeLimit = 45000 + verse.code_v2.length * 500; // 45 seconds + extra time based on glyph length

    // Create quiz content (no embed, just text and image)
    let quizContent = `**Translation Quiz Challenge**\n\n`;
    quizContent += `**Which translation matches this verse?**\n\n`;
    quizContent += `**Instructions:** Look at the Arabic text below and choose the correct English translation below. You have ${
      timeLimit / 1000
    } seconds to answer!\n\n`;

    // Add translation choices
    shuffledChoices.forEach((choice, index) => {
      const letter = String.fromCharCode(65 + index);
      quizContent += `> **${letter}.** ${choice}\n\n`;
    });

    quizContent += `**Rewards:** ✅ Correct: +6 XP | ❌ Wrong: -3 XP | ⏰ Timeout: -1 XP\n`;
    quizContent += `**Level ${
      Math.floor((user.experience?.experience || 0) / 100) + 1
    }** • ${user.experience?.experience || 0} XP`;

    const quizMessage = await safeEditReply(interaction, {
      content: quizContent,
      components,
      files: [attachment],
    });

    if (!quizMessage) {
      console.error("Failed to send quiz message");
      return;
    }

    // Create collector

    const collector = quizMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: timeLimit,
      filter: (i) => i.user.id === userId,
    });

    collector.on("collect", async (componentInteraction) => {
      try {
        // Check if component interaction is valid and not expired
        if (!componentInteraction.isButton()) {
          console.log("Invalid component interaction type");
          return;
        }

        await componentInteraction.deferUpdate();
      } catch (error) {
        console.error("Error deferring component interaction:", error.message);

        // Handle specific Discord API errors
        if (error.code === 10062) {
          console.log("Interaction expired, stopping collector");
          collector.stop("expired");
          return;
        } else if (error.code === 40060) {
          console.log("Interaction already acknowledged");
          // Continue with the logic even if defer failed
        } else {
          console.error("Unexpected error in component interaction:", error);
          return;
        }
      }

      // Get selected answer
      const selectedIndex = parseInt(
        componentInteraction.customId.split("_")[2]
      );
      const selectedAnswer = shuffledChoices[selectedIndex];
      const isCorrect = selectedIndex === correctIndex;

      // Calculate XP and update stats
      const xpChange = isCorrect ? 6 : -3;
      const newXP = Math.max(0, (user.experience?.experience || 0) + xpChange);
      const newLevel = Math.floor(newXP / 100) + 1;

      try {
        // Update database
        await prisma.userExperience.upsert({
          where: { userId: user.id },
          update: { experience: newXP },
          create: { userId: user.id, experience: newXP },
        });

        // Update quiz statistics (Type Four)
        const currentStats = user.quizStatsTypeFour;
        const newStreak = isCorrect ? (currentStats?.streaks || 0) + 1 : 0;

        // Check if attemptsToday should be reset (if last updated was yesterday)
        let attemptsTodayUpdate = { increment: 1 };
        let streaksUpdate = newStreak;
        let updatedAt = user.quizStatsTypeFour?.updatedAt;
        if (updatedAt) {
          const last = new Date(updatedAt);
          const now = new Date();
          // If last update was before today (i.e., yesterday or earlier), reset attemptsToday
          if (
            last.getUTCFullYear() !== now.getUTCFullYear() ||
            last.getUTCMonth() !== now.getUTCMonth() ||
            last.getUTCDate() !== now.getUTCDate()
          ) {
            attemptsTodayUpdate = 1;
          }
        }

        await prisma.quranQuizTypeFourStats.upsert({
          where: { userId: user.id },
          update: {
            attempts: { increment: 1 },
            attemptsToday: attemptsTodayUpdate,
            streaks: streaksUpdate,
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
      } catch (dbError) {
        console.error("Database update error:", dbError.message);
      }

      // Create result content
      let resultContent = `${
        isCorrect ? "🎉 **Correct!**" : "❌ **Incorrect!**"
      }\n\n`;

      if (isCorrect) {
        resultContent += `Great job! You correctly identified the translation.\n\n`;
      } else {
        resultContent += `The correct answer was **${String.fromCharCode(
          65 + correctIndex
        )}**.\n\n`;

        // Show all choices with correct answer bolded
        resultContent += `📋 **All Choices:**\n`;
        shuffledChoices.forEach((choice, index) => {
          const letter = String.fromCharCode(65 + index);
          if (index === correctIndex) {
            resultContent += `> **${letter}. ${choice}** ✅\n`;
          } else if (index === selectedIndex) {
            resultContent += `> ${letter}. ${choice} ❌\n`;
          } else {
            resultContent += `> ${letter}. ${choice}\n`;
          }
        });
        resultContent += `\n`;
      }

      resultContent += `📖 **Verse Details:**\n`;
      resultContent += `**${correctChapterData.name_arabic}** (${correctChapterData.name_simple})\n`;
      resultContent += `Chapter ${correctChapterId} • ${correctChapterData.verses_count} verses\n`;
      resultContent += `Revealed in ${correctChapterData.revelation_place}\n\n`;

      resultContent += `📍 **Verse Location:** ${verse.verse_key} • Page ${verse.page_number} • Juz ${verse.juz_number}\n\n`;

      if (selectedAnswer === "None of the above" && isCorrect) {
        resultContent += `✅ You answered **None of the above**, but the correct translation was:\n> ${correctTranslationText}\n\n`;
      }

      resultContent += `✅ **Correct Translation:**\n${cleanedCorrectTranslation}\n\n`;

      resultContent += `💫 **Stats Update:**\n`;
      resultContent += `${xpChange > 0 ? "+" : ""}${xpChange} XP\n`;
      resultContent += `Total: ${newXP} XP (Level ${newLevel})\n\n`;

      resultContent += `🎮 Play again with \`/translation-quiz\` to earn more XP!`;

      // Disable all buttons and highlight correct answer
      const disabledButtons = buttons.map((button, index) => {
        const newButton = ButtonBuilder.from(button);
        if (index === correctIndex) {
          newButton.setStyle(ButtonStyle.Success);
        } else if (index === selectedIndex && !isCorrect) {
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

      try {
        await safeEditReply(interaction, {
          content: resultContent,
          components: disabledComponents,
          files: [attachment],
        });
      } catch (replyError) {
        console.error("Error updating quiz result:", replyError.message);
      }

      collector.stop("answered");
    });

    collector.on("end", async (collected, reason) => {
      // Remove user from queue when collector ends
      try {
        await prisma.quranQuizQueue.deleteMany({
          where: { userId: user.id },
        });
      } catch (queueCleanupError) {
        console.error(
          "Error removing user from queue:",
          queueCleanupError.message
        );
      }

      try {
        if (collected.size === 0 && reason !== "expired") {
          // Timeout - apply XP penalty
          const timeoutXpPenalty = -1;
          const newXP = Math.max(
            0,
            (user.experience?.experience || 0) + timeoutXpPenalty
          );
          const newLevel = Math.floor(newXP / 100) + 1;

          try {
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

            // Update timeout stats for Type Four
            // Check if attemptsToday should be reset (if last updated was yesterday)
            let attemptsTodayUpdate = { increment: 1 };
            let updatedAt = user.quizStatsTypeFour?.updatedAt;
            if (updatedAt) {
              const last = new Date(updatedAt);
              const now = new Date();
              // If last update was before today (i.e., yesterday or earlier), reset attemptsToday
              if (
                last.getUTCFullYear() !== now.getUTCFullYear() ||
                last.getUTCMonth() !== now.getUTCMonth() ||
                last.getUTCDate() !== now.getUTCDate()
              ) {
                attemptsTodayUpdate = 1;
              }
            }

            await prisma.quranQuizTypeFourStats.upsert({
              where: { userId: user.id },
              update: {
                attempts: { increment: 1 },
                attemptsToday: attemptsTodayUpdate,
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
          } catch (dbError) {
            console.error("Database timeout update error:", dbError.message);
          }

          let timeoutContent = `⏰ **Time's Up!**\n\n`;
          timeoutContent += `Time ran out! The correct answer was **${String.fromCharCode(
            65 + correctIndex
          )}**.\n\n`;

          // Show all choices with correct answer bolded
          timeoutContent += `📋 **All Choices:**\n`;
          shuffledChoices.forEach((choice, index) => {
            const letter = String.fromCharCode(65 + index);
            if (index === correctIndex) {
              timeoutContent += `> **${letter}. ${choice}** ✅\n`;
            } else {
              timeoutContent += `> ${letter}. ${choice}\n`;
            }
          });
          timeoutContent += `\n`;

          timeoutContent += `✅ **Correct Translation:**\n${cleanedCorrectTranslation}\n\n`;

          timeoutContent += `💫 **XP Penalty:** ${timeoutXpPenalty} XP\n`;
          timeoutContent += `Total: ${newXP} XP (Level ${newLevel})\n\n`;

          timeoutContent += `💡 Try again with \`/translation-quiz\` to test your knowledge!`;

          // Show correct answer
          const disabledButtons = buttons.map((button, index) => {
            const newButton = ButtonBuilder.from(button);
            if (index === correctIndex) {
              newButton.setStyle(ButtonStyle.Success);
            } else {
              newButton.setStyle(ButtonStyle.Secondary);
            }
            newButton.setDisabled(true);
            return newButton;
          });

          const disabledComponents = [
            new ActionRowBuilder().addComponents(disabledButtons),
          ];

          try {
            await safeEditReply(interaction, {
              content: timeoutContent,
              components: disabledComponents,
              files: [attachment],
            });
          } catch (timeoutReplyError) {
            console.error(
              "Error sending timeout message:",
              timeoutReplyError.message
            );
          }
        } else if (reason === "expired") {
          console.log("Quiz collector expired due to interaction timeout");
        }
      } catch (endError) {
        console.error("Error in collector end handler:", endError.message);
      }
    });
  } catch (error) {
    console.error("Error in translation quiz:", error);

    // Remove user from queue on error
    try {
      await prisma.quranQuizQueue.deleteMany({
        where: { userId: user?.id },
      });
    } catch (queueCleanupError) {
      console.error(
        "Error cleaning up queue on error:",
        queueCleanupError.message
      );
    }

    // Only try to respond if we haven't already responded
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content:
            "❌ An error occurred while loading the quiz. Please try again.",
          ephemeral: true,
        });
      } catch (replyError) {
        console.error("Failed to send error reply:", replyError.message);
      }
    } else {
      try {
        await safeEditReply(interaction, {
          content:
            "❌ Quiz Error\n\nFailed to load quiz question. Please try again later.",
        });
      } catch (editError) {
        console.error("Failed to edit reply with error:", editError.message);
      }
    }
  } finally {
    try {
      await quranVerses.disconnect();
      await quranChapters.disconnect();
      await translations.disconnect();
      await prisma.$disconnect();
    } catch (cleanupError) {
      console.error("Error during cleanup:", cleanupError.message);
    }
  }
}

// Helper function to generate wrong translations from the same chapter
async function generateSameChapterTranslations(
  correctText,
  verseKey,
  chapterId,
  translations
) {
  const wrongTranslations = [];
  const quranVerses = new QuranVerses();

  try {
    // Get all verses from the same chapter
    const chapterVerses = await quranVerses.getAllVersesInChapter(chapterId);

    // Filter out the current verse and shuffle the remaining verses
    const otherVerses = chapterVerses.filter((v) => v.verse_key !== verseKey);
    const shuffledVerses = shuffleArray(otherVerses);

    // Get translations for up to 6 random verses from the same chapter (increased to ensure we get 4)
    for (
      let i = 0;
      i < Math.min(6, shuffledVerses.length) && wrongTranslations.length < 4;
      i++
    ) {
      try {
        const randomVerse = shuffledVerses[i];
        const response = await translations.getTranslationByAyah(
          20,
          randomVerse.verse_key
        );

        if (response.translations && response.translations.length > 0) {
          const translation = response.translations[0];

          // Only add if it's not the same as correct translation and not already included
          if (
            translation.text !== correctText &&
            !wrongTranslations.includes(translation.text)
          ) {
            wrongTranslations.push(translation.text);
          }
        }
      } catch (error) {
        console.warn(
          `Failed to get translation for ${shuffledVerses[i].verse_key}:`,
          error.message
        );
      }
    }

    // If we don't have enough translations from the same chapter, fall back to random verses
    while (wrongTranslations.length < 4) {
      try {
        const randomVerse = await quranVerses.getRandomVerse();
        if (randomVerse && randomVerse.verse_key !== verseKey) {
          const response = await translations.getTranslationByAyah(
            20,
            randomVerse.verse_key
          );

          if (response.translations && response.translations.length > 0) {
            const translation = response.translations[0];

            if (
              translation.text !== correctText &&
              !wrongTranslations.includes(translation.text)
            ) {
              wrongTranslations.push(translation.text);

              // Break if we've reached our target
              if (wrongTranslations.length >= 4) {
                break;
              }
            }
          }
        }
      } catch (error) {
        console.warn("Failed to get random verse translation:", error.message);

        // Prevent infinite loop in case of persistent errors
        if (wrongTranslations.length === 0) {
          break;
        }
      }
    }
  } catch (error) {
    console.error("Error getting chapter verses:", error.message);
  } finally {
    try {
      await quranVerses.disconnect();
    } catch (cleanupError) {
      console.error("Error cleaning up QuranVerses:", cleanupError.message);
    }
  }

  return wrongTranslations;
}

// Helper function to clean HTML tags from text
function cleanHtmlTags(text) {
  if (!text) return text;

  return (
    text
      // Remove HTML tags like <sup>, </sup>, etc.
      .replace(/<[^>]*>/g, "")
      // Remove foot note references like foot_note=230198
      .replace(/foot_note=\d+/g, "")
      // Clean up extra spaces that might result from tag removal
      .replace(/\s+/g, " ")
      // Trim whitespace
      .trim()
  );
}

// Helper function to safely edit replies
async function safeEditReply(interaction, options) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(options);
    } else {
      return await interaction.reply(options);
    }
  } catch (error) {
    console.error("Error in safeEditReply:", error.message);

    // If it's an API error, don't throw but log it
    if (
      error.code === 40060 ||
      error.code === "InteractionNotReplied" ||
      error.code === 10062
    ) {
      console.log("Interaction state issue, continuing execution");
      return null;
    }

    throw error;
  }
}

// Helper function to shuffle array
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper function to slice translations to similar lengths
function sliceTranslationsToSimilarLength(translations, attempts) {
  if (!translations || translations.length === 0) return translations;

  // Find the shortest translation length
  const minLength = Math.min(...translations.map((t) => t.length));

  // Calculate a reasonable slice length (between 60% and 90% of shortest)
  // but ensure it's at least 50 characters for readability
  // If attempts is provided, make it more challenging by reducing slice length as attempts increase
  let difficultyFactor = 1;
  if (typeof attempts === "number" && attempts > 0) {
    // Reduce slice length by up to 30% as attempts increase, min 60% of original
    difficultyFactor = Math.max(0.1, 1 - attempts * 0.01);
  }
  const sliceLength = Math.max(
    20,
    Math.floor(minLength * difficultyFactor) + 20
  );

  return translations.map((translation) => {
    if (translation.length <= sliceLength + 20) {
      return translation; // Keep short translations as they are (with some buffer)
    }

    // For longer translations, always slice from middle
    const startPos = Math.floor((translation.length - sliceLength) / 2);
    return (
      "..." + translation.substring(startPos, startPos + sliceLength) + "..."
    );
  });
}
