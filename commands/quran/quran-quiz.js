// QUIZ TYPE ONE

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
  .setName("quran-quiz")
  .setDescription(
    "Test your Quran knowledge - guess the chapter from a verse!"
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

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Get random verse from any chapter
    const verse = await quranVerses.getRandomVerse();

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

    // Generate wrong answers
    const wrongAnswers = await generateWrongAnswers(correctChapterId);

    // Create answer choices (1 correct + 4 wrong)
    const allChoices = [correctChapterName, ...wrongAnswers];
    const shuffledChoices = shuffleArray(allChoices);
    const correctIndex = shuffledChoices.indexOf(correctChapterName);

    // Create verse image
    const imgAttachment = canvas.createQuranImage({
      glyph: verse.code_v2.slice(0, -1),
      pages: verse.page_number,
      height: (verse.code_v2.length / 10) * 50 + 150,
    });

    const attachment = new AttachmentBuilder(imgAttachment, {
      name: "quiz-verse.png",
    });

    // Create buttons for choices
    const buttons = shuffledChoices.map((choice, index) =>
      new ButtonBuilder()
        .setCustomId(`quiz_answer_${index}`)
        .setLabel(`${String.fromCharCode(65 + index)}. ${choice}`) // A, B, C, D, E
        .setStyle(ButtonStyle.Primary)
    );

    const actionRow = new ActionRowBuilder().addComponents(buttons);

    // Create quiz embed
    const embed = new EmbedBuilder()
      .setTitle("🧩 Quran Quiz Challenge")
      .setDescription(
        "**Which chapter (surah) is this verse from?**\n*Look at the Arabic text and choose the correct answer below.*"
      )
      .setColor(0x4dabf7)
      .addFields(
        {
          name: "🎯 Instructions",
          value:
            "Click the button with the correct chapter name. You have 30 seconds to answer!",
          inline: false,
        },
        {
          name: "🏆 Rewards",
          value: "✅ Correct: +10 XP\n❌ Wrong: -2 XP",
          inline: true,
        }
      )
      .setImage("attachment://quiz-verse.png")
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
      files: [attachment],
    });

    // Create collector for button interactions
    const collector = quizMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30000, // 30 seconds
      filter: (i) => i.user.id === userId,
    });

    collector.on("collect", async (buttonInteraction) => {
      await buttonInteraction.deferUpdate();

      const selectedIndex = parseInt(buttonInteraction.customId.split("_")[2]);
      const isCorrect = selectedIndex === correctIndex;
      const selectedAnswer = shuffledChoices[selectedIndex];

      // Update user experience
      let xpChange = 0;
      let newLevel = user.experience?.level || 1;
      let newXP = user.experience?.experience || 0;

      if (isCorrect) {
        xpChange = 10;
        newXP += 10;
        // Simple level calculation (every 100 XP = 1 level)
        newLevel = Math.floor(newXP / 100) + 1;
      } else {
        xpChange = -2;
        newXP = Math.max(0, newXP - 2); // Don't go below 0
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

      // Update quiz statistics (Type One)
      await prisma.quranQuizTypeOneStats.upsert({
        where: { userId: user.id },
        update: {
          attempts: { increment: 1 },
          corrects: isCorrect ? { increment: 1 } : undefined,
        },
        create: {
          userId: user.id,
          attempts: 1,
          corrects: isCorrect ? 1 : 0,
          timeouts: 0,
        },
      });

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
            value: `**${correctChapterData.name_arabic}** (${correctChapterName})\nChapter ${correctChapterId} • ${correctChapterData.verses_count} verses\nRevealed in ${correctChapterData.revelation_place}`,
            inline: false,
          },
          {
            name: "📍 Verse Location",
            value: `${verse.verse_key} • Page ${verse.page_number} • Juz ${verse.juz_number}`,
            inline: true,
          },
          {
            name: "💫 XP Update",
            value: `${
              xpChange > 0 ? "+" : ""
            }${xpChange} XP\nTotal: ${newXP} XP (Level ${newLevel})`,
            inline: true,
          }
        )
        .setFooter({
          text: "Play again with /quran-quiz to earn more XP!",
        })
        .setTimestamp();

      // Disable all buttons
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

      const disabledRow = new ActionRowBuilder().addComponents(disabledButtons);

      await interaction.editReply({
        embeds: [resultEmbed],
        components: [disabledRow],
        files: [attachment],
      });

      collector.stop();
    });

    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        // Timeout - no answer given, update timeout stats
        await prisma.quranQuizTypeOneStats.upsert({
          where: { userId: user.id },
          update: {
            attempts: { increment: 1 },
            timeouts: { increment: 1 },
          },
          create: {
            userId: user.id,
            attempts: 1,
            corrects: 0,
            timeouts: 1,
          },
        });

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
              value: `**${correctChapterData.name_arabic}** (${correctChapterName})\nChapter ${correctChapterId} • ${correctChapterData.verses_count} verses`,
              inline: false,
            },
            {
              name: "💡 Try Again",
              value: "Use `/quran-quiz` to test your knowledge again!",
              inline: false,
            }
          )
          .setTimestamp();

        // Disable all buttons
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

        const disabledRow = new ActionRowBuilder().addComponents(
          disabledButtons
        );

        await interaction.editReply({
          embeds: [timeoutEmbed],
          components: [disabledRow],
          files: [attachment],
        });
      }
    });
  } catch (error) {
    console.error("Error in quran quiz:", error);

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
  };
  return chapterNames[chapterId] || `Chapter ${chapterId}`;
}
