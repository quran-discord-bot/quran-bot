// QUIZ TYPE ONE

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
  .setName("quiz-quran-chapter")
  .setDescription("Test your Quran knowledge - guess the chapter from a verse!")
  .addIntegerOption((option) =>
    option
      .setName("juz")
      .setDescription("Choose a specific Juz (1-30) for the quiz")
      .setMinValue(1)
      .setMaxValue(30)
      .setRequired(false)
  );

export async function execute(interaction) {
  const quranVerses = new QuranVerses();
  const quranChapters = new QuranChapters();
  const canvas = new QuranCanvas();

  try {
    // Check if interaction is already acknowledged
    if (interaction.replied || interaction.deferred) {
      console.log("Interaction already acknowledged, skipping defer");
    } else {
      await interaction.deferReply();
    }

    const userId = interaction.user.id;
    const customJuz = interaction.options.getInteger("juz");

    // Check if user is registered
    const user = await prisma.user.findUnique({
      where: { discordId: userId },
      include: {
        experience: true,
        settings: true,
        quizStatsTypeOne: true,
      },
    });

    if (!user) {
      const embed = new EmbedBuilder()
        .setTitle("🚫 Registration Required")
        .setDescription(
          "You need to register first before playing the Quran quiz!"
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

      await safeEditReply(interaction, { embeds: [embed] });
      return;
    }

    // Check and reset daily attempts if it's a new day
    const today = new Date().toDateString();
    const lastUpdate = user.quizStatsTypeOne?.updatedAt?.toDateString();
    const isNewDay = today !== lastUpdate;

    if (isNewDay && user.quizStatsTypeOne) {
      await prisma.quranQuizTypeOneStats.update({
        where: { userId: user.id },
        data: { attemptsToday: 0 },
      });
    }

    // Get current daily attempts
    const currentStats = await prisma.quranQuizTypeOneStats.findUnique({
      where: { userId: user.id },
    });
    const attemptsToday = isNewDay ? 0 : currentStats?.attemptsToday || 0;

    // Get random verse
    let verse;
    if (customJuz) {
      verse = await quranVerses.getRandomVerseByJuz(customJuz);
    } else {
      verse = await quranVerses.getRandomVerse();
    }

    if (!verse) {
      await interaction.editReply(
        "❌ Failed to get quiz question. Please try again."
      );
      return;
    }

    // Extract chapter ID from verse_key
    const correctChapterId = parseInt(verse.verse_key.split(":")[0]);
    const correctChapterData = await quranChapters.getChapterData(
      correctChapterId
    );
    const correctChapterName = getChapterName(correctChapterId);

    // Create verse image
    const imgAttachment = canvas.createQuranImage({
      glyph: verse.code_v2.slice(0, -1),
      pages: verse.page_number,
      height: (verse.code_v2.length / 10) * 50 + 150,
    });

    const attachment = new AttachmentBuilder(imgAttachment, {
      name: "quiz-verse.png",
    });

    let components;
    let embed;
    let shuffledChoices = []; // Store shuffled choices for consistency

    // Check if user has more than 5 attempts today - use select menu for increased difficulty
    if (attemptsToday >= 5) {
      // Generate 25 adjacent chapter options for select menu centered around correct answer
      const allChapterNames = getAllChapterNames();
      const totalChapters = allChapterNames.length;

      // Calculate range to show 25 chapters with correct answer somewhere in the middle
      let startIndex, endIndex;
      const rangeSize = 25;
      const correctIndex = correctChapterId - 1; // Convert to 0-based index

      // Try to center the correct answer, but adjust if we're near the edges
      let idealStart = correctIndex - Math.floor(rangeSize / 2);

      if (idealStart < 0) {
        startIndex = 0;
        endIndex = Math.min(rangeSize, totalChapters);
      } else if (idealStart + rangeSize > totalChapters) {
        endIndex = totalChapters;
        startIndex = Math.max(0, totalChapters - rangeSize);
      } else {
        startIndex = idealStart;
        endIndex = idealStart + rangeSize;
      }

      // Create options for the selected range
      const selectedChapters = allChapterNames.slice(startIndex, endIndex);
      const options = selectedChapters.map((name, index) => ({
        label: `${startIndex + index + 1}. ${name}`,
        value: (startIndex + index + 1).toString(), // Convert back to 1-based chapter ID
        description: `Chapter ${startIndex + index + 1}`,
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("quiz_select_answer")
        .setPlaceholder("Select the correct chapter...")
        .addOptions(options);

      components = [new ActionRowBuilder().addComponents(selectMenu)];

      embed = new EmbedBuilder()
        .setTitle("🧩 Advanced Quran Quiz Challenge")
        .setDescription(
          `**Which chapter (surah) is this verse from?**\n*Select from the chapters below. You have 45 seconds to answer!*${
            customJuz ? `\n\n📖 **Custom Juz ${customJuz}** - No XP earned` : ""
          }`
        )
        .setColor(customJuz ? 0xffa500 : 0xff9500)
        .addFields(
          {
            name: "🔥 Advanced Mode",
            value: customJuz
              ? `🎓 Practice Mode - Custom Juz ${customJuz}`
              : `You've completed ${attemptsToday} attempts today! Choose from ${selectedChapters.length} adjacent chapters.`,
            inline: false,
          },
          {
            name: "🏆 Rewards",
            value: customJuz
              ? "🎓 Practice Mode - No XP/stats affected"
              : "✅ Correct: +15 XP\n❌ Wrong: -7 XP",
            inline: true,
          },
          {
            name: "🔥 Current Streak",
            value: customJuz
              ? "Practice Mode"
              : `${currentStats?.streaks || 0} correct in a row`,
            inline: true,
          },
          {
            name: "📖 Chapter Range",
            value: `Chapters ${startIndex + 1} - ${endIndex}`,
            inline: true,
          }
        )
        .setImage("attachment://quiz-verse.png")
        .setFooter({
          text: `Level ${Math.floor(
            (user.experience?.experience || 0) / 100
          )} • ${user.experience?.experience || 0} XP`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();
    } else {
      // Generate wrong answers for button mode
      const wrongAnswers = await generateWrongAnswers(correctChapterId);

      // Create answer choices (1 correct + 4 wrong)
      const allChoices = [correctChapterName, ...wrongAnswers];
      shuffledChoices = shuffleArray(allChoices); // Store the shuffled choices

      // Create buttons for choices
      const buttons = shuffledChoices.map((choice, index) =>
        new ButtonBuilder()
          .setCustomId(`quiz_answer_${index}`)
          .setLabel(`${String.fromCharCode(65 + index)}. ${choice}`) // A, B, C, D, E
          .setStyle(ButtonStyle.Primary)
      );

      components = [new ActionRowBuilder().addComponents(buttons)];

      embed = new EmbedBuilder()
        .setTitle("🧩 Quran Quiz Challenge")
        .setDescription(
          `**Which chapter (surah) is this verse from?**\n*Look at the Arabic text and choose the correct answer below.*${
            customJuz ? `\n\n📖 **Custom Juz ${customJuz}** - No XP earned` : ""
          }`
        )
        .setColor(customJuz ? 0xffa500 : 0x4dabf7)
        .addFields(
          {
            name: "🎯 Instructions",
            value:
              "Click the button with the correct chapter name. You have 30 seconds to answer!",
            inline: false,
          },
          {
            name: "🏆 Rewards",
            value: customJuz
              ? "🎓 Practice Mode - No XP/stats affected"
              : "✅ Correct: +10 XP\n❌ Wrong: -2 XP",
            inline: true,
          },
          {
            name: "📊 Today's Progress",
            value: customJuz
              ? "Practice Mode"
              : `${attemptsToday}/5 attempts\n${
                  currentStats?.streaks || 0
                } streak`,
            inline: true,
          }
        )
        .setImage("attachment://quiz-verse.png")
        .setFooter({
          text: `Level ${Math.floor(
            (user.experience?.experience || 0) / 100
          )} • ${user.experience?.experience || 0} XP`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();
    }

    const quizMessage = await safeEditReply(interaction, {
      embeds: [embed],
      components,
      files: [attachment],
    });

    if (!quizMessage) {
      console.error("Failed to send quiz message");
      return;
    }

    // Create collector for interactions
    const timeLimit = attemptsToday >= 5 ? 45000 : 30000; // 45s for advanced, 30s for normal
    const collector = quizMessage.createMessageComponentCollector({
      componentType:
        attemptsToday >= 5 ? ComponentType.StringSelect : ComponentType.Button,
      time: timeLimit,
      filter: (i) => i.user.id === userId,
    });

    collector.on("collect", async (componentInteraction) => {
      try {
        await componentInteraction.deferUpdate();
      } catch (error) {
        console.error("Error deferring component interaction:", error.message);
        return;
      }

      let isCorrect = false;
      let selectedAnswer = "";
      let correctIndex = -1;
      let selectedIndex = -1;

      if (attemptsToday >= 5) {
        // Select menu mode
        const selectedChapterId = parseInt(componentInteraction.values[0]);
        isCorrect = selectedChapterId === correctChapterId;
        selectedAnswer = getChapterName(selectedChapterId);
      } else {
        // Button mode - use the stored shuffled choices
        selectedIndex = parseInt(componentInteraction.customId.split("_")[2]);
        correctIndex = shuffledChoices.indexOf(correctChapterName);
        selectedAnswer = shuffledChoices[selectedIndex];
        isCorrect = selectedAnswer === correctChapterName;
      }

      // Calculate XP and streak changes (only if not custom Juz)
      let xpChange = 0;
      let newLevel = Math.floor((user.experience?.experience || 0) / 100) + 1;
      let newXP = user.experience?.experience || 0;
      let newStreak = currentStats?.streaks || 0;

      if (!customJuz) {
        if (isCorrect) {
          xpChange = attemptsToday >= 5 ? 15 : 10; // More XP for advanced mode
          newXP += xpChange;
          newStreak += 1;
          newLevel = Math.floor(newXP / 100) + 1;
        } else {
          xpChange = attemptsToday >= 5 ? -7 : -2; // More penalty for advanced mode
          newXP = Math.max(0, newXP + xpChange);
          newStreak = 0; // Reset streak on wrong answer
          newLevel = Math.floor(newXP / 100) + 1;
        }
      }

      // Update database (only if not custom Juz)
      if (!customJuz) {
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

        // Update quiz statistics (Type One)
        await prisma.quranQuizTypeOneStats.upsert({
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
      }

      // Create result embed
      const resultEmbed = new EmbedBuilder()
        .setTitle(isCorrect ? "🎉 Correct!" : "❌ Incorrect!")
        .setDescription(
          isCorrect
            ? `Great job! You correctly identified **${correctChapterName}**.`
            : `The correct answer was **${correctChapterName}**, but you chose **${selectedAnswer}**.`
        )
        .setColor(isCorrect ? 0x51cf66 : 0xff6b6b)
        .addFields(
          {
            name: "📖 Chapter Details",
            value: `**${
              correctChapterData.name_arabic
            }** (${correctChapterName})\nChapter ${correctChapterId} • ${
              correctChapterData.verses_count
            } verses\nRevealed in ${correctChapterData.revelation_place}${
              customJuz ? `\n🎓 Custom Juz ${customJuz} Practice` : ""
            }`,
            inline: false,
          },
          {
            name: "📍 Verse Location",
            value: `${verse.verse_key} • Page ${verse.page_number} • Juz ${verse.juz_number}`,
            inline: true,
          },
          {
            name: "💫 Stats Update",
            value: customJuz
              ? "🎓 Practice Mode - No stats affected"
              : `${
                  xpChange > 0 ? "+" : ""
                }${xpChange} XP\nTotal: ${newXP} XP (Level ${newLevel})\n🔥 Streak: ${newStreak}`,
            inline: true,
          },
          {
            name: "📊 Today's Progress",
            value: customJuz
              ? "Practice Mode"
              : `${attemptsToday + 1} attempts${
                  attemptsToday + 1 === 5 ? "\n🚀 Advanced mode unlocked!" : ""
                }`,
            inline: true,
          }
        )
        .setFooter({
          text: "Play again with /quran-chapter-quiz to earn more XP!",
        })
        .setTimestamp();

      // Handle components based on mode
      let disabledComponents = [];

      if (attemptsToday >= 5) {
        // Select menu mode - disable the select menu
        const disabledSelectMenu = StringSelectMenuBuilder.from(
          components[0].components[0]
        )
          .setDisabled(true)
          .setPlaceholder(
            isCorrect
              ? "✅ Correct answer selected!"
              : "❌ Incorrect answer selected"
          );

        disabledComponents = [
          new ActionRowBuilder().addComponents(disabledSelectMenu),
        ];
      } else {
        // Button mode - disable and color the buttons using stored shuffled choices
        const buttons = shuffledChoices.map((choice, index) =>
          new ButtonBuilder()
            .setCustomId(`quiz_answer_${index}`)
            .setLabel(`${String.fromCharCode(65 + index)}. ${choice}`)
            .setStyle(ButtonStyle.Primary)
        );

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

        disabledComponents = [
          new ActionRowBuilder().addComponents(disabledButtons),
        ];
      }

      await interaction.editReply({
        embeds: [resultEmbed],
        components: disabledComponents,
        files: [attachment],
      });

      collector.stop();
    });

    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        // Timeout - update timeout stats and apply XP penalty (only if not custom Juz)
        let timeoutXpPenalty = 0;
        let newXP = user.experience?.experience || 0;
        let newLevel = Math.floor(newXP / 100) + 1;

        if (!customJuz) {
          timeoutXpPenalty = attemptsToday >= 5 ? -3 : -1;
          newXP = Math.max(0, newXP + timeoutXpPenalty);
          newLevel = Math.floor(newXP / 100) + 1;

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

          await prisma.quranQuizTypeOneStats.upsert({
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
        }

        // Timeout - no answer given
        const timeoutEmbed = new EmbedBuilder()
          .setTitle("⏰ Time's Up!")
          .setDescription(
            `Time ran out! The correct answer was **${correctChapterName}**.`
          )
          .setColor(0xffa500)
          .addFields(
            {
              name: "📖 Chapter Details",
              value: `**${
                correctChapterData.name_arabic
              }** (${correctChapterName})\nChapter ${correctChapterId} • ${
                correctChapterData.verses_count
              } verses${
                customJuz ? `\n🎓 Custom Juz ${customJuz} Practice` : ""
              }`,
              inline: false,
            },
            {
              name: "💫 XP Penalty",
              value: customJuz
                ? "🎓 Practice Mode - No stats affected"
                : `${timeoutXpPenalty} XP\nTotal: ${newXP} XP (Level ${newLevel})`,
              inline: true,
            },
            {
              name: "💡 Try Again",
              value: "Use `/quran-chapter-quiz` to test your knowledge again!",
              inline: false,
            }
          )
          .setTimestamp();

        try {
          await safeEditReply(interaction, {
            embeds: [timeoutEmbed],
            components: [],
            files: [attachment],
          });
        } catch (error) {
          console.error("Error updating timeout message:", error.message);
        }
      }
    });
  } catch (error) {
    console.error("Error in quran quiz:", error);

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
        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Quiz Error")
          .setDescription(
            "Failed to load quiz question. Please try again later."
          )
          .setColor(0xff6b6b)
          .setTimestamp();

        await safeEditReply(interaction, { embeds: [errorEmbed] });
      } catch (editError) {
        console.error("Failed to edit reply with error:", editError.message);
      }
    }
  } finally {
    try {
      await quranVerses.disconnect();
      await quranChapters.disconnect();
      await prisma.$disconnect();
    } catch (cleanupError) {
      console.error("Error during cleanup:", cleanupError.message);
    }
  }
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
    if (error.code === 40060 || error.code === "InteractionNotReplied") {
      console.log("Interaction state issue, continuing execution");
      return null;
    }

    throw error;
  }
}

// Helper function to get all chapter names
function getAllChapterNames() {
  return [
    "Al-Fatihah",
    "Al-Baqarah",
    "Ali 'Imran",
    "An-Nisa",
    "Al-Ma'idah",
    "Al-An'am",
    "Al-A'raf",
    "Al-Anfal",
    "At-Tawbah",
    "Yunus",
    "Hud",
    "Yusuf",
    "Ar-Ra'd",
    "Ibrahim",
    "Al-Hijr",
    "An-Nahl",
    "Al-Isra",
    "Al-Kahf",
    "Maryam",
    "Taha",
    "Al-Anbiya",
    "Al-Hajj",
    "Al-Mu'minun",
    "An-Nur",
    "Al-Furqan",
    "Ash-Shu'ara",
    "An-Naml",
    "Al-Qasas",
    "Al-'Ankabut",
    "Ar-Rum",
    "Luqman",
    "As-Sajdah",
    "Al-Ahzab",
    "Saba",
    "Fatir",
    "Ya-Sin",
    "As-Saffat",
    "Sad",
    "Az-Zumar",
    "Ghafir",
    "Fussilat",
    "Ash-Shuraa",
    "Az-Zukhruf",
    "Ad-Dukhan",
    "Al-Jathiyah",
    "Al-Ahqaf",
    "Muhammad",
    "Al-Fath",
    "Al-Hujurat",
    "Qaf",
    "Adh-Dhariyat",
    "At-Tur",
    "An-Najm",
    "Al-Qamar",
    "Ar-Rahman",
    "Al-Waqi'ah",
    "Al-Hadid",
    "Al-Mujadila",
    "Al-Hashr",
    "Al-Mumtahanah",
    "As-Saff",
    "Al-Jumu'ah",
    "Al-Munafiqun",
    "At-Taghabun",
    "At-Talaq",
    "At-Tahrim",
    "Al-Mulk",
    "Al-Qalam",
    "Al-Haqqah",
    "Al-Ma'arij",
    "Nuh",
    "Al-Jinn",
    "Al-Muzzammil",
    "Al-Muddaththir",
    "Al-Qiyamah",
    "Al-Insan",
    "Al-Mursalat",
    "An-Naba",
    "An-Nazi'at",
    "'Abasa",
    "At-Takwir",
    "Al-Infitar",
    "Al-Mutaffifin",
    "Al-Inshiqaq",
    "Al-Buruj",
    "At-Tariq",
    "Al-A'la",
    "Al-Ghashiyah",
    "Al-Fajr",
    "Al-Balad",
    "Ash-Shams",
    "Al-Layl",
    "Ad-Duhaa",
    "Ash-Sharh",
    "At-Tin",
    "Al-'Alaq",
    "Al-Qadr",
    "Al-Bayyinah",
    "Az-Zalzalah",
    "Al-'Adiyat",
    "Al-Qari'ah",
    "At-Takathur",
    "Al-'Asr",
    "Al-Humazah",
    "Al-Fil",
    "Quraysh",
    "Al-Ma'un",
    "Al-Kawthar",
    "Al-Kafirun",
    "An-Nasr",
    "Al-Masad",
    "Al-Ikhlas",
    "Al-Falaq",
    "An-Nas",
  ];
}

// Helper function to generate wrong answers
async function generateWrongAnswers(correctChapterId) {
  const allChapterNames = [
    "Al-Fatihah",
    "Al-Baqarah",
    "Ali 'Imran",
    "An-Nisa",
    "Al-Ma'idah",
    "Al-An'am",
    "Al-A'raf",
    "Al-Anfal",
    "At-Tawbah",
    "Yunus",
    "Hud",
    "Yusuf",
    "Ar-Ra'd",
    "Ibrahim",
    "Al-Hijr",
    "An-Nahl",
    "Al-Isra",
    "Al-Kahf",
    "Maryam",
    "Taha",
    "Al-Anbiya",
    "Al-Hajj",
    "Al-Mu'minun",
    "An-Nur",
    "Al-Furqan",
    "Ash-Shu'ara",
    "An-Naml",
    "Al-Qasas",
    "Al-'Ankabut",
    "Ar-Rum",
    "Luqman",
    "As-Sajdah",
    "Al-Ahzab",
    "Saba",
    "Fatir",
    "Ya-Sin",
    "As-Saffat",
    "Sad",
    "Az-Zumar",
    "Ghafir",
    "Fussilat",
    "Ash-Shuraa",
    "Az-Zukhruf",
    "Ad-Dukhan",
    "Al-Jathiyah",
    "Al-Ahqaf",
    "Muhammad",
    "Al-Fath",
    "Al-Hujurat",
    "Qaf",
    "Adh-Dhariyat",
    "At-Tur",
    "An-Najm",
    "Al-Qamar",
    "Ar-Rahman",
    "Al-Waqi'ah",
    "Al-Hadid",
    "Al-Mujadila",
    "Al-Hashr",
    "Al-Mumtahanah",
    "As-Saff",
    "Al-Jumu'ah",
    "Al-Munafiqun",
    "At-Taghabun",
    "At-Talaq",
    "At-Tahrim",
    "Al-Mulk",
    "Al-Qalam",
    "Al-Haqqah",
    "Al-Ma'arij",
    "Nuh",
    "Al-Jinn",
    "Al-Muzzammil",
    "Al-Muddaththir",
    "Al-Qiyamah",
    "Al-Insan",
    "Al-Mursalat",
    "An-Naba",
    "An-Nazi'at",
    "'Abasa",
    "At-Takwir",
    "Al-Infitar",
    "Al-Mutaffifin",
    "Al-Inshiqaq",
    "Al-Buruj",
    "At-Tariq",
    "Al-A'la",
    "Al-Ghashiyah",
    "Al-Fajr",
    "Al-Balad",
    "Ash-Shams",
    "Al-Layl",
    "Ad-Duhaa",
    "Ash-Sharh",
    "At-Tin",
    "Al-'Alaq",
    "Al-Qadr",
    "Al-Bayyinah",
    "Az-Zalzalah",
    "Al-'Adiyat",
    "Al-Qari'ah",
    "At-Takathur",
    "Al-'Asr",
    "Al-Humazah",
    "Al-Fil",
    "Quraysh",
    "Al-Ma'un",
    "Al-Kawthar",
    "Al-Kafirun",
    "An-Nasr",
    "Al-Masad",
    "Al-Ikhlas",
    "Al-Falaq",
    "An-Nas",
  ];

  const correctName = allChapterNames[correctChapterId - 1];
  const wrongNames = allChapterNames.filter((name) => name !== correctName);

  // Shuffle and take 4 random wrong answers
  const shuffled = shuffleArray([...wrongNames]);
  return shuffled.slice(0, 4);
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

// Helper function to get chapter names (fallback)
function getChapterName(chapterId) {
  const chapterNames = {
    1: "Al-Fatihah",
    2: "Al-Baqarah",
    3: "Ali 'Imran",
    4: "An-Nisa",
    5: "Al-Ma'idah",
    6: "Al-An'am",
    7: "Al-A'raf",
    8: "Al-Anfal",
    9: "At-Tawbah",
    10: "Yunus",
    11: "Hud",
    12: "Yusuf",
    13: "Ar-Ra'd",
    14: "Ibrahim",
    15: "Al-Hijr",
    16: "An-Nahl",
    17: "Al-Isra",
    18: "Al-Kahf",
    19: "Maryam",
    20: "Taha",
    21: "Al-Anbiya",
    22: "Al-Hajj",
    23: "Al-Mu'minun",
    24: "An-Nur",
    25: "Al-Furqan",
    26: "Ash-Shu'ara",
    27: "An-Naml",
    28: "Al-Qasas",
    29: "Al-'Ankabut",
    30: "Ar-Rum",
    31: "Luqman",
    32: "As-Sajdah",
    33: "Al-Ahzab",
    34: "Saba",
    35: "Fatir",
    36: "Ya-Sin",
    37: "As-Saffat",
    38: "Sad",
    39: "Az-Zumar",
    40: "Ghafir",
    41: "Fussilat",
    42: "Ash-Shuraa",
    43: "Az-Zukhruf",
    44: "Ad-Dukhan",
    45: "Al-Jathiyah",
    46: "Al-Ahqaf",
    47: "Muhammad",
    48: "Al-Fath",
    49: "Al-Hujurat",
    50: "Qaf",
    51: "Adh-Dhariyat",
    52: "At-Tur",
    53: "An-Najm",
    54: "Al-Qamar",
    55: "Ar-Rahman",
    56: "Al-Waqi'ah",
    57: "Al-Hadid",
    58: "Al-Mujadila",
    59: "Al-Hashr",
    60: "Al-Mumtahanah",
    61: "As-Saff",
    62: "Al-Jumu'ah",
    63: "Al-Munafiqun",
    64: "At-Taghabun",
    65: "At-Talaq",
    66: "At-Tahrim",
    67: "Al-Mulk",
    68: "Al-Qalam",
    69: "Al-Haqqah",
    70: "Al-Ma'arij",
    71: "Nuh",
    72: "Al-Jinn",
    73: "Al-Muzzammil",
    74: "Al-Muddaththir",
    75: "Al-Qiyamah",
    76: "Al-Insan",
    77: "Al-Mursalat",
    78: "An-Naba",
    79: "An-Nazi'at",
    80: "'Abasa",
    81: "At-Takwir",
    82: "Al-Infitar",
    83: "Al-Mutaffifin",
    84: "Al-Inshiqaq",
    85: "Al-Buruj",
    86: "At-Tariq",
    87: "Al-A'la",
    88: "Al-Ghashiyah",
    89: "Al-Fajr",
    90: "Al-Balad",
    91: "Ash-Shams",
    92: "Al-Layl",
    93: "Ad-Duhaa",
    94: "Ash-Sharh",
    95: "At-Tin",
    96: "Al-'Alaq",
    97: "Al-Qadr",
    98: "Al-Bayyinah",
    99: "Az-Zalzalah",
    100: "Al-'Adiyat",
    101: "Al-Qari'ah",
    102: "At-Takathur",
    103: "Al-'Asr",
    104: "Al-Humazah",
    105: "Al-Fil",
    106: "Quraysh",
    107: "Al-Ma'un",
    108: "Al-Kawthar",
    109: "Al-Kafirun",
    110: "An-Nasr",
    111: "Al-Masad",
    112: "Al-Ikhlas",
    113: "Al-Falaq",
    114: "An-Nas",
    105: "Al-Fil",
    106: "Quraysh",
    107: "Al-Ma'un",
    108: "Al-Kawthar",
    109: "Al-Kafirun",
    110: "An-Nasr",
    111: "Al-Masad",
    112: "Al-Ikhlas",
    113: "Al-Falaq",
    114: "An-Nas",
  };
  return chapterNames[chapterId] || `Chapter ${chapterId}`;
}
