import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { PrismaClient } from "../../generated/prisma/index.js";

const prisma = new PrismaClient();

export const data = new SlashCommandBuilder()
  .setName("register-all-guilds")
  .setDescription(
    "Register all guilds the bot is currently in (Bot Owner Only)"
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  try {
    // Check if user is bot owner (you should replace this with your Discord ID)
    const botOwnerId = process.env.BOT_OWNER_ID; // Add this to your .env file

    if (interaction.user.id !== botOwnerId) {
      const embed = new EmbedBuilder()
        .setTitle("🚫 Access Denied")
        .setDescription("This command can only be used by the bot owner.")
        .setColor(0xff6b6b)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const client = interaction.client;
    const guilds = client.guilds.cache;

    let registeredCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const [guildId, guild] of guilds) {
      try {
        // Check if guild already exists
        const existingGuild = await prisma.guild.findUnique({
          where: { discordId: guildId },
        });

        if (existingGuild) {
          // Guild already registered, just update timestamp
          await prisma.guild.update({
            where: { discordId: guildId },
            data: { updatedAt: new Date() },
          });

          updatedCount++;
          results.push(
            `✅ **${guild.name}** - Already registered, updated timestamp`
          );
        } else {
          // Register new guild
          await prisma.guild.create({
            data: {
              discordId: guildId,
              settings: {
                create: {
                  language: "en", // Default language
                },
              },
            },
          });

          registeredCount++;
          results.push(`🆕 **${guild.name}** - Newly registered`);
        }

        // Register commands for this guild
        await registerGuildCommands(client, guildId);
      } catch (error) {
        console.error(
          `Error processing guild ${guild.name} (${guildId}):`,
          error
        );
        errorCount++;
        results.push(`❌ **${guild.name}** - Error: ${error.message}`);
      }
    }

    // Also trigger the enhanced initialization function for consistency
    console.log("Running enhanced command initialization...");
    try {
      // Import the initialization function from the main bot file
      // This ensures all guilds get proper command setup
      await initializeAllGuildsFromDatabase(client);
    } catch (initError) {
      console.error("Error during enhanced initialization:", initError);
    }

    // Create summary embed
    const embed = new EmbedBuilder()
      .setTitle("🏰 Bulk Guild Registration Complete")
      .setDescription(`Processed ${guilds.size} guilds total.`)
      .setColor(0x00ff00)
      .addFields({
        name: "📊 Summary",
        value:
          `🆕 New Registrations: ${registeredCount}\n` +
          `✅ Updated Existing: ${updatedCount}\n` +
          `❌ Errors: ${errorCount}`,
        inline: false,
      })
      .setTimestamp();

    // Add detailed results if they fit
    const resultText = results.join("\n");
    if (resultText.length <= 1024) {
      embed.addFields({
        name: "📋 Detailed Results",
        value: resultText,
        inline: false,
      });
    } else {
      // Split into multiple fields if too long
      const chunks = [];
      let currentChunk = "";

      for (const result of results) {
        if (currentChunk.length + result.length + 1 <= 1024) {
          currentChunk += (currentChunk ? "\n" : "") + result;
        } else {
          chunks.push(currentChunk);
          currentChunk = result;
        }
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      chunks.forEach((chunk, index) => {
        embed.addFields({
          name:
            index === 0
              ? "📋 Detailed Results"
              : `📋 Results (cont. ${index + 1})`,
          value: chunk,
          inline: false,
        });
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in bulk guild registration:", error);

    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Bulk Registration Error")
      .setDescription(
        "Failed to complete bulk guild registration. Check console for details."
      )
      .setColor(0xff6b6b)
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

// Helper function to register commands for a specific guild
async function registerGuildCommands(client, guildId) {
  try {
    const { REST, Routes } = await import("discord.js");
    const commands = [];

    // Get all commands from the client
    client.commands.forEach((command) => {
      commands.push(command.data.toJSON());
    });

    const rest = new REST().setToken(process.env.BOT_TOKEN);

    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
      { body: commands }
    );

    console.log(`Registered ${data.length} commands for guild ${guildId}`);
    return data;
  } catch (error) {
    console.error(`Error registering commands for guild ${guildId}:`, error);
    throw error;
  }
}

// Enhanced initialization function to sync with database
async function initializeAllGuildsFromDatabase(client) {
  try {
    const { REST, Routes } = await import("discord.js");

    // Get all registered guilds from database
    const registeredGuilds = await prisma.guild.findMany({
      select: { discordId: true },
    });

    console.log(
      `Found ${registeredGuilds.length} registered guilds in database for command sync.`
    );

    const rest = new REST().setToken(process.env.BOT_TOKEN);
    const allCommands = [];

    // Get all commands from the client
    client.commands.forEach((command) => {
      allCommands.push(command.data.toJSON());
    });

    // Initialize commands for all registered guilds
    for (const guild of registeredGuilds) {
      try {
        const currentGuild = client.guilds.cache.get(guild.discordId);
        if (currentGuild) {
          await rest.put(
            Routes.applicationGuildCommands(
              process.env.CLIENT_ID,
              guild.discordId
            ),
            { body: allCommands }
          );
          console.log(
            `Synced commands for registered guild: ${currentGuild.name}`
          );
        }
      } catch (error) {
        console.error(
          `Error syncing commands for guild ${guild.discordId}:`,
          error
        );
      }
    }

    // For unregistered guilds, only setup command
    const setupCommand = allCommands.find((cmd) => cmd.name === "setup-guild");
    if (setupCommand) {
      for (const [guildId, guild] of client.guilds.cache) {
        const isRegistered = registeredGuilds.some(
          (rg) => rg.discordId === guildId
        );
        if (!isRegistered) {
          try {
            await rest.put(
              Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
              { body: [setupCommand] }
            );
            console.log(
              `Registered setup command for unregistered guild: ${guild.name}`
            );
          } catch (error) {
            console.error(
              `Error registering setup for guild ${guildId}:`,
              error
            );
          }
        }
      }
    }

    console.log("Enhanced guild initialization complete.");
  } catch (error) {
    console.error("Error in enhanced guild initialization:", error);
  }
}
