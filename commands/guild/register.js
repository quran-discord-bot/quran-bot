import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import { PrismaClient } from "../../generated/prisma/index.js";
import { REST, Routes } from "discord.js";

const prisma = new PrismaClient();

export const data = new SlashCommandBuilder()
  .setName("setup-guild")
  .setDescription("Register and configure this guild for Quran Bot")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName("language")
      .setDescription("Set the default language for this guild")
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
  .addChannelOption((option) =>
    option
      .setName("log-channel")
      .setDescription("Channel for bot activity logs (optional)")
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildText)
  )
  .addChannelOption((option) =>
    option
      .setName("quiz-channel")
      .setDescription("Dedicated channel for quiz activities (optional)")
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildText)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const guildId = interaction.guild.id;
    const language = interaction.options.getString("language") || "en";
    const logChannel = interaction.options.getChannel("log-channel");
    const quizChannel = interaction.options.getChannel("quiz-channel");

    // Check if guild is already registered
    const existingGuild = await prisma.guild.findUnique({
      where: { discordId: guildId },
      include: {
        settings: true,
      },
    });

    if (existingGuild) {
      // Update existing guild settings
      await prisma.guildSetting.upsert({
        where: { guildId: existingGuild.id },
        update: {
          language: language,
          logChannelId: logChannel?.id || null,
          quizChannelId: quizChannel?.id || null,
        },
        create: {
          guildId: existingGuild.id,
          language: language,
          logChannelId: logChannel?.id || null,
          quizChannelId: quizChannel?.id || null,
        },
      });

      const embed = new EmbedBuilder()
        .setTitle("🔄 Guild Settings Updated!")
        .setDescription(
          `Guild settings have been successfully updated for **${interaction.guild.name}**.`
        )
        .setColor(0xffa500) // Orange color
        .addFields(
          {
            name: "🌍 Default Language",
            value: getLanguageName(language),
            inline: true,
          },
          {
            name: "📝 Log Channel",
            value: logChannel ? `<#${logChannel.id}>` : "Not set",
            inline: true,
          },
          {
            name: "🧩 Quiz Channel",
            value: quizChannel ? `<#${quizChannel.id}>` : "Not set",
            inline: true,
          },
          {
            name: "📅 Last Updated",
            value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
            inline: true,
          }
        )
        .setFooter({
          text: "Use this command again to update settings",
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Register new guild
    const newGuild = await prisma.guild.create({
      data: {
        discordId: guildId,
        settings: {
          create: {
            language: language,
            logChannelId: logChannel?.id || null,
            quizChannelId: quizChannel?.id || null,
          },
        },
      },
      include: {
        settings: true,
      },
    });

    // Reload commands for this guild
    await reloadGuildCommands(interaction.client, guildId);

    // Create success embed
    const embed = new EmbedBuilder()
      .setTitle("🎉 Guild Registration Successful!")
      .setDescription(
        `Welcome to the Quran Bot community, **${interaction.guild.name}**! Your guild has been successfully registered.`
      )
      .setColor(0x00ff00) // Green color
      .addFields(
        {
          name: "🌍 Default Language",
          value: getLanguageName(language),
          inline: true,
        },
        {
          name: "📝 Log Channel",
          value: logChannel ? `<#${logChannel.id}>` : "Not set",
          inline: true,
        },
        {
          name: "🧩 Quiz Channel",
          value: quizChannel ? `<#${quizChannel.id}>` : "Not set",
          inline: true,
        },
        {
          name: "👥 Guild Members",
          value: `${interaction.guild.memberCount} members`,
          inline: true,
        },
        {
          name: "📅 Registered",
          value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
          inline: true,
        },
        {
          name: "🎁 Features Unlocked",
          value: "All bot commands are now available in this guild!",
          inline: false,
        }
      )
      .setThumbnail(interaction.guild.iconURL())
      .setFooter({
        text: "Use /onboarding to help your members get started!",
      })
      .setTimestamp();

    // Log to designated channel if set
    if (logChannel) {
      try {
        const logEmbed = new EmbedBuilder()
          .setTitle("🏰 Guild Registered")
          .setDescription(
            `Guild **${interaction.guild.name}** has been registered with Quran Bot.`
          )
          .setColor(0x00ff00)
          .addFields(
            {
              name: "Configured by",
              value: `<@${interaction.user.id}>`,
              inline: true,
            },
            {
              name: "Default Language",
              value: getLanguageName(language),
              inline: true,
            }
          )
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
      } catch (logError) {
        console.error("Error sending log message:", logError);
      }
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error during guild registration:", error);

    let errorMessage = "❌ Guild registration failed. Please try again later.";

    // Handle specific database errors
    if (error.code === "P2002") {
      errorMessage = "❌ Guild already exists in the system.";
    } else if (error.code === "P2003") {
      errorMessage = "❌ Database constraint error. Please contact support.";
    } else if (error.code === "P1001") {
      errorMessage = "❌ Database connection failed. Please try again later.";
    }

    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Guild Registration Error")
      .setDescription(errorMessage)
      .setColor(0xff0000) // Red color
      .setTimestamp();

    try {
      await interaction.editReply({ embeds: [errorEmbed] });
    } catch (replyError) {
      console.error("Failed to send error reply:", replyError);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to reload commands for a specific guild
async function reloadGuildCommands(client, guildId) {
  try {
    const commands = [];

    // Get all commands from the client
    client.commands.forEach((command) => {
      commands.push(command.data.toJSON());
    });

    const rest = new REST().setToken(process.env.BOT_TOKEN);

    console.log(
      `Started refreshing ${commands.length} application (/) commands for guild ${guildId}.`
    );

    // Deploy commands to the specific guild
    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
      { body: commands }
    );

    console.log(
      `Successfully reloaded ${data.length} application (/) commands for guild ${guildId}.`
    );
  } catch (error) {
    console.error(`Error reloading commands for guild ${guildId}:`, error);
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
