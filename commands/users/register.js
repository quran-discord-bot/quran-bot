import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { PrismaClient } from "../../generated/prisma/index.js";

const prisma = new PrismaClient();

export const data = new SlashCommandBuilder()
  .setName("register")
  .setDescription("Register your account to start using bot features")
  .addStringOption((option) =>
    option
      .setName("language")
      .setDescription("Set your preferred language for translations")
      .setRequired(false)
      .addChoices(
        { name: "English", value: "en" },
        { name: "Arabic", value: "ar" },
        { name: "Indonesian", value: "id" },
        { name: "Urdu", value: "ur" },
        { name: "French", value: "fr" },
        { name: "Spanish", value: "es" },
        { name: "Turkish", value: "tr" },
        { name: "German", value: "de" }
      )
  )
  .addStringOption((option) =>
    option
      .setName("theme")
      .setDescription("Set your preferred theme")
      .setRequired(false)
      .addChoices(
        { name: "Light", value: "light" },
        { name: "Dark", value: "dark" }
      )
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const language = interaction.options.getString("language") || "en";
    const theme = interaction.options.getString("theme") || "light";

    // Check if user is already registered
    const existingUser = await prisma.user.findUnique({
      where: { discordId: userId },
      include: {
        settings: true,
        experience: true,
        streak: true,
      },
    });

    if (existingUser) {
      const embed = new EmbedBuilder()
        .setTitle("📝 Already Registered!")
        .setDescription(
          "You're already registered! Here are your current details:"
        )
        .setColor(0xffa500) // Orange color
        .addFields(
          {
            name: "🌍 Language",
            value: getLanguageName(existingUser.settings?.language || "en"),
            inline: true,
          },
          {
            name: "🎨 Theme",
            value: existingUser.settings?.theme || "light",
            inline: true,
          },
          {
            name: "⭐ Level",
            value: `${
              Math.floor(existingUser.experience?.experience / 100) + 1 || 1
            }`,
            inline: true,
          },
          {
            name: "🏆 Experience",
            value: `${existingUser.experience?.experience || 0} XP`,
            inline: true,
          },
          {
            name: "🔥 Streak",
            value: `${existingUser.streak?.streak || 0} days`,
            inline: true,
          },
          {
            name: "📅 Registered",
            value: `<t:${Math.floor(
              existingUser.createdAt.getTime() / 1000
            )}:R>`,
            inline: true,
          }
        )
        .setFooter({
          text: "Use /settings to update your preferences",
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Register new user with all related data
    const newUser = await prisma.user.create({
      data: {
        discordId: userId,
        settings: {
          create: {
            language: language,
            theme: theme,
          },
        },
        experience: {
          create: {
            experience: 0,
          },
        },
        streak: {
          create: {
            streak: 0,
            lastActive: null,
          },
        },
      },
      include: {
        settings: true,
        experience: true,
        streak: true,
      },
    });

    // Create success embed
    const embed = new EmbedBuilder()
      .setTitle("🎉 Registration Successful!")
      .setDescription(
        `Welcome to the community, <@${userId}>! Your account has been successfully registered.`
      )
      .setColor(0x00ff00) // Green color
      .addFields(
        {
          name: "🌍 Language",
          value: getLanguageName(language),
          inline: true,
        },
        {
          name: "🎨 Theme",
          value: theme,
          inline: true,
        },
        {
          name: "⭐ Starting Level",
          value: "1",
          inline: true,
        },
        {
          name: "🏆 Experience Points",
          value: "0 XP",
          inline: true,
        },
        {
          name: "🔥 Daily Streak",
          value: "0 days",
          inline: true,
        },
        {
          name: "🎁 Welcome Bonus",
          value: "You've earned 10 XP for registering!",
          inline: false,
        }
      )
      .setTimestamp()
      .setThumbnail(interaction.user.displayAvatarURL());

    // Give welcome bonus XP
    await prisma.userExperience.update({
      where: { userId: newUser.id },
      data: {
        experience: 10,
      },
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error during user registration:", error);

    let errorMessage = "❌ Registration failed. Please try again later.";

    // Handle specific database errors
    if (error.code === "P2002") {
      errorMessage = "❌ User already exists in the system.";
    } else if (error.code === "P2003") {
      errorMessage = "❌ Database constraint error. Please contact support.";
    } else if (error.code === "P1001") {
      errorMessage = "❌ Database connection failed. Please try again later.";
    }

    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Registration Error")
      .setDescription(errorMessage)
      .setColor(0xff0000) // Red color
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  } finally {
    // Clean up database connection
    await prisma.$disconnect();
  }
}

// Helper function to get language display names
function getLanguageName(code) {
  const languages = {
    en: "English",
    ar: "العربية (Arabic)",
    id: "Indonesian",
    ur: "اردو (Urdu)",
    fr: "Français",
    es: "Español",
    tr: "Türkçe",
    de: "Deutsch",
  };

  return languages[code] || "English";
}
