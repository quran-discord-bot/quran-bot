import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { PrismaClient } from "../../generated/prisma/index.js";

const prisma = new PrismaClient();

export const data = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("View or update your account settings")
  .addSubcommand((subcommand) =>
    subcommand.setName("view").setDescription("View your current settings")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("language")
      .setDescription("Change your preferred language for translations")
      .addStringOption((option) =>
        option
          .setName("value")
          .setDescription("Select your preferred language")
          .setRequired(true)
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
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("theme")
      .setDescription("Change your preferred theme")
      .addStringOption((option) =>
        option
          .setName("value")
          .setDescription("Select your preferred theme")
          .setRequired(true)
          .addChoices(
            { name: "Light", value: "light" },
            { name: "Dark", value: "dark" }
          )
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("reset")
      .setDescription("Reset all settings to default values")
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const subcommand = interaction.options.getSubcommand();

    // Check if user is registered
    const user = await prisma.user.findUnique({
      where: { discordId: userId },
      include: {
        settings: true,
        experience: true,
        streak: true,
      },
    });

    if (!user) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Not Registered")
        .setDescription("You need to register first before accessing settings.")
        .setColor(0xff0000)
        .addFields({
          name: "💡 How to register",
          value:
            "Use `/register` to create your account and access all features!",
          inline: false,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    switch (subcommand) {
      case "view":
        await handleViewSettings(interaction, user);
        break;
      case "language":
        await handleLanguageUpdate(interaction, user);
        break;
      case "theme":
        await handleThemeUpdate(interaction, user);
        break;
      case "reset":
        await handleResetSettings(interaction, user);
        break;
      default:
        await interaction.editReply("❌ Invalid subcommand.");
    }
  } catch (error) {
    console.error("Error in settings command:", error);

    let errorMessage = "❌ Settings operation failed. Please try again later.";

    if (error.code === "P2025") {
      errorMessage =
        "❌ User settings not found. Please try registering again.";
    } else if (error.code === "P1001") {
      errorMessage = "❌ Database connection failed. Please try again later.";
    }

    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Settings Error")
      .setDescription(errorMessage)
      .setColor(0xff0000)
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  } finally {
    await prisma.$disconnect();
  }
}

async function handleViewSettings(interaction, user) {
  const embed = new EmbedBuilder()
    .setTitle("⚙️ Your Settings")
    .setDescription(
      `Here are your current account settings, <@${interaction.user.id}>`
    )
    .setColor(0x0099ff)
    .addFields(
      {
        name: "🌍 Language",
        value: getLanguageName(user.settings?.language || "en"),
        inline: true,
      },
      {
        name: "🎨 Theme",
        value: capitalizeFirst(user.settings?.theme || "light"),
        inline: true,
      },
      {
        name: "📊 Account Stats",
        value: `Level ${user.experience?.level || 1} • ${
          user.experience?.experience || 0
        } XP`,
        inline: true,
      },
      {
        name: "🔥 Streak",
        value: `${user.streak?.streak || 0} days`,
        inline: true,
      },
      {
        name: "📅 Last Updated",
        value: user.settings?.updatedAt
          ? `<t:${Math.floor(user.settings.updatedAt.getTime() / 1000)}:R>`
          : "Never",
        inline: true,
      },
      {
        name: "🛠️ Quick Actions",
        value:
          "• `/settings language` - Change language\n• `/settings theme` - Change theme\n• `/settings reset` - Reset to defaults",
        inline: false,
      }
    )
    .setThumbnail(interaction.user.displayAvatarURL())
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleLanguageUpdate(interaction, user) {
  const newLanguage = interaction.options.getString("value");
  const oldLanguage = user.settings?.language || "en";

  if (oldLanguage === newLanguage) {
    const embed = new EmbedBuilder()
      .setTitle("🌍 Language Setting")
      .setDescription(
        `Your language is already set to **${getLanguageName(newLanguage)}**.`
      )
      .setColor(0xffa500)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Update language setting
  await prisma.userSetting.upsert({
    where: { userId: user.id },
    update: { language: newLanguage },
    create: {
      userId: user.id,
      language: newLanguage,
      theme: "light", // default theme if creating new settings
    },
  });

  const embed = new EmbedBuilder()
    .setTitle("🌍 Language Updated!")
    .setDescription(`Your language preference has been successfully updated.`)
    .setColor(0x00ff00)
    .addFields(
      {
        name: "Previous Language",
        value: getLanguageName(oldLanguage),
        inline: true,
      },
      {
        name: "New Language",
        value: getLanguageName(newLanguage),
        inline: true,
      },
      {
        name: "✨ What's Next?",
        value:
          "Your new language preference will be used for translations in commands like `/random-ayah`!",
        inline: false,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleThemeUpdate(interaction, user) {
  const newTheme = interaction.options.getString("value");
  const oldTheme = user.settings?.theme || "light";

  if (oldTheme === newTheme) {
    const embed = new EmbedBuilder()
      .setTitle("🎨 Theme Setting")
      .setDescription(
        `Your theme is already set to **${capitalizeFirst(newTheme)}**.`
      )
      .setColor(0xffa500)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Update theme setting
  await prisma.userSetting.upsert({
    where: { userId: user.id },
    update: { theme: newTheme },
    create: {
      userId: user.id,
      language: "en", // default language if creating new settings
      theme: newTheme,
    },
  });

  const themeEmoji = newTheme === "dark" ? "🌙" : "☀️";
  const embed = new EmbedBuilder()
    .setTitle(`🎨 Theme Updated! ${themeEmoji}`)
    .setDescription(`Your theme preference has been successfully updated.`)
    .setColor(newTheme === "dark" ? 0x2f3136 : 0xffffff)
    .addFields(
      {
        name: "Previous Theme",
        value: `${oldTheme === "dark" ? "🌙" : "☀️"} ${capitalizeFirst(
          oldTheme
        )}`,
        inline: true,
      },
      {
        name: "New Theme",
        value: `${themeEmoji} ${capitalizeFirst(newTheme)}`,
        inline: true,
      },
      {
        name: "✨ What's Next?",
        value:
          "Your theme preference will affect the appearance of bot responses and embeds!",
        inline: false,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleResetSettings(interaction, user) {
  const oldSettings = {
    language: user.settings?.language || "en",
    theme: user.settings?.theme || "light",
  };

  // Reset settings to defaults
  await prisma.userSetting.upsert({
    where: { userId: user.id },
    update: {
      language: "en",
      theme: "light",
    },
    create: {
      userId: user.id,
      language: "en",
      theme: "light",
    },
  });

  const embed = new EmbedBuilder()
    .setTitle("🔄 Settings Reset!")
    .setDescription("All your settings have been reset to default values.")
    .setColor(0x00ff00)
    .addFields(
      {
        name: "🌍 Language",
        value: `${getLanguageName(oldSettings.language)} → ${getLanguageName(
          "en"
        )}`,
        inline: true,
      },
      {
        name: "🎨 Theme",
        value: `${capitalizeFirst(oldSettings.theme)} → ${capitalizeFirst(
          "light"
        )}`,
        inline: true,
      },
      {
        name: "💡 Need Help?",
        value:
          "Use `/settings view` to see your current settings, or update them individually with `/settings language` and `/settings theme`.",
        inline: false,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
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

// Helper function to capitalize first letter
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
