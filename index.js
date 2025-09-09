import fs from "node:fs";
import path from "node:path";
import {
  Client,
  Collection,
  GatewayIntentBits,
  EmbedBuilder,
} from "discord.js";
import { configDotenv } from "dotenv";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { REST, Routes } from "discord.js";
import { PrismaClient } from "./generated/prisma/index.js";

// Load environment variables from .env file
configDotenv();
const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const prisma = new PrismaClient();

client.commands = new Collection();

const __dirname = dirname(fileURLToPath(import.meta.url));
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(pathToFileURL(filePath).href);
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));
for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = await import(pathToFileURL(filePath).href);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

const commands = [];

for (const folder of commandFolders) {
  // Grab all the command files from the commands directory you created earlier
  const commandsPath = join(foldersPath, folder);
  const commandFiles = readdirSync(commandsPath).filter((file) =>
    file.endsWith(".js")
  );
  // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command = await import(pathToFileURL(filePath).href);
    if ("data" in command && "execute" in command) {
      commands.push(command.data.toJSON());
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// Function to register commands for a specific guild
async function registerGuildCommands(guildId) {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands for guild ${guildId}.`
    );

    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    console.log(
      `Successfully reloaded ${data.length} application (/) commands for guild ${guildId}.`
    );
    return data;
  } catch (error) {
    console.error(`Error registering commands for guild ${guildId}:`, error);
    return null;
  }
}

// Function to register commands for all guilds
async function registerCommandsForAllGuilds() {
  try {
    // Get all registered guilds from database
    const registeredGuilds = await prisma.guild.findMany({
      select: { discordId: true },
    });

    console.log(
      `Found ${registeredGuilds.length} registered guilds in database.`
    );

    // Register commands for each guild
    for (const guild of registeredGuilds) {
      await registerGuildCommands(guild.discordId);
    }

    // Also register the guild setup command globally (or for the main guild)
    if (guildId) {
      await registerGuildCommands(guildId);
    }

    console.log("Finished registering commands for all guilds.");
  } catch (error) {
    console.error("Error registering commands for all guilds:", error);
  }
}

// Enhanced function to initialize commands for all guilds (registered + current)
async function initializeCommandsForAllGuilds() {
  try {
    console.log("Starting command initialization for all guilds...");

    // Get all registered guilds from Prisma
    const registeredGuilds = await prisma.guild.findMany({
      select: { discordId: true, settings: true },
    });

    console.log(
      `Found ${registeredGuilds.length} registered guilds in database.`
    );

    // Get all guilds the bot is currently in
    const currentGuilds = client.guilds.cache;
    console.log(`Bot is currently in ${currentGuilds.size} guilds.`);

    // Create a Set of registered guild IDs for quick lookup
    const registeredGuildIds = new Set(
      registeredGuilds.map((g) => g.discordId)
    );

    // Track initialization results
    let registeredCount = 0;
    let unregisteredCount = 0;
    let errorCount = 0;

    // Initialize commands for all registered guilds
    for (const guild of registeredGuilds) {
      try {
        // Check if bot is still in this guild
        const currentGuild = client.guilds.cache.get(guild.discordId);
        if (currentGuild) {
          await registerGuildCommands(guild.discordId);
          registeredCount++;
          console.log(
            `✅ Initialized commands for registered guild: ${currentGuild.name} (${guild.discordId})`
          );
        } else {
          console.log(
            `⚠️ Bot no longer in registered guild: ${guild.discordId}`
          );
        }
      } catch (error) {
        console.error(
          `❌ Error initializing commands for registered guild ${guild.discordId}:`,
          error
        );
        errorCount++;
      }
    }

    // For guilds the bot is in but not registered, only register the setup-guild command
    for (const [guildId, guild] of currentGuilds) {
      if (!registeredGuildIds.has(guildId)) {
        try {
          // Only register the setup-guild command for unregistered guilds
          const setupCommand = commands.find(
            (cmd) => cmd.name === "setup-guild"
          );
          if (setupCommand) {
            const data = await rest.put(
              Routes.applicationGuildCommands(clientId, guildId),
              { body: [setupCommand] }
            );
            unregisteredCount++;
            console.log(
              `🔧 Registered setup command for unregistered guild: ${guild.name} (${guildId})`
            );
          }
        } catch (error) {
          console.error(
            `❌ Error registering setup command for unregistered guild ${guildId}:`,
            error
          );
          errorCount++;
        }
      }
    }

    // Register global commands (setup-guild only)
    try {
      const globalCommands = commands.filter(
        (cmd) => cmd.name === "setup-guild"
      );
      if (globalCommands.length > 0) {
        const globalData = await rest.put(
          Routes.applicationCommands(clientId),
          {
            body: globalCommands,
          }
        );
        console.log(
          `🌍 Successfully registered ${globalData.length} global commands.`
        );
      }
    } catch (error) {
      console.error("❌ Error registering global commands:", error);
    }

    console.log(`\n📊 Command Initialization Summary:`);
    console.log(`✅ Registered guilds initialized: ${registeredCount}`);
    console.log(`🔧 Unregistered guilds (setup only): ${unregisteredCount}`);
    console.log(`❌ Errors encountered: ${errorCount}`);
    console.log(`🎉 Command initialization complete!\n`);
  } catch (error) {
    console.error("Error during command initialization:", error);
  }
}

// Utility function to refresh commands for all guilds from Prisma
async function refreshAllGuildCommands() {
  try {
    console.log("🔄 Refreshing commands for all guilds from database...");

    const registeredGuilds = await prisma.guild.findMany({
      select: { discordId: true },
      include: { settings: true },
    });

    console.log(
      `📋 Found ${registeredGuilds.length} guilds in database to refresh.`
    );

    let successCount = 0;
    let failureCount = 0;

    for (const guild of registeredGuilds) {
      try {
        const discordGuild = client.guilds.cache.get(guild.discordId);

        if (discordGuild) {
          await registerGuildCommands(guild.discordId);
          successCount++;
          console.log(
            `✅ Refreshed commands for: ${discordGuild.name} (${guild.discordId})`
          );
        } else {
          console.log(`⚠️ Guild not found in bot cache: ${guild.discordId}`);
          failureCount++;
        }
      } catch (error) {
        console.error(
          `❌ Failed to refresh commands for guild ${guild.discordId}:`,
          error
        );
        failureCount++;
      }
    }

    console.log(
      `\n🏁 Refresh Summary: ${successCount} successful, ${failureCount} failed\n`
    );
    return { successCount, failureCount, total: registeredGuilds.length };
  } catch (error) {
    console.error("Error refreshing guild commands:", error);
    return { successCount: 0, failureCount: 0, total: 0 };
  }
}

// Export functions for external use
export {
  refreshAllGuildCommands,
  initializeCommandsForAllGuilds,
  registerGuildCommands,
};

// Initial command registration (for development/main guild)
(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    // Register for main development guild
    if (guildId) {
      await registerGuildCommands(guildId);
    }

    // Register global commands (only setup-guild command for now)
    const globalCommands = commands.filter((cmd) => cmd.name === "setup-guild");
    if (globalCommands.length > 0) {
      const globalData = await rest.put(Routes.applicationCommands(clientId), {
        body: globalCommands,
      });
      console.log(
        `Successfully registered ${globalData.length} global application (/) commands.`
      );
    }
  } catch (error) {
    console.error(error);
  }
})();

// Clean up quiz queue on bot startup
client.once("ready", async () => {
  console.log(`Bot ${client.user.tag} is ready!`);

  try {
    // Delete all queue entries on bot startup
    const deletedCount = await prisma.quranQuizQueue.deleteMany({});
    console.log(
      `Cleared ${deletedCount.count} entries from quiz queue on startup`
    );

    // Get all guild IDs from Prisma and initialize commands
    await initializeCommandsForAllGuilds();

    // Start scheduled cleanup for old queue entries (every 2 minutes)
    setInterval(async () => {
      try {
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        const deletedOldEntries = await prisma.quranQuizQueue.deleteMany({
          where: {
            createdAt: {
              lt: twoMinutesAgo,
            },
          },
        });

        if (deletedOldEntries.count > 0) {
          console.log(
            `Cleaned up ${deletedOldEntries.count} old queue entries (older than 2 minutes)`
          );
        }
      } catch (cleanupError) {
        console.error(
          "Error during scheduled queue cleanup:",
          cleanupError.message
        );
      }
    }, 2 * 60 * 1000); // Run every 2 minutes
  } catch (error) {
    console.error("Error during bot startup queue cleanup:", error.message);
  }
});

// Handle guild join events
client.on("guildCreate", async (guild) => {
  console.log(`Joined new guild: ${guild.name} (${guild.id})`);

  try {
    // Register the setup-guild command for the new guild
    await registerGuildCommands(guild.id);

    // Try to send a welcome message to the system channel or general channel
    const systemChannel =
      guild.systemChannel ||
      guild.channels.cache.find(
        (channel) =>
          channel.type === 0 &&
          channel
            .permissionsFor(guild.members.me)
            .has(["SendMessages", "ViewChannel"])
      );

    if (systemChannel) {
      const welcomeEmbed = new EmbedBuilder()
        .setTitle("🎉 Thank you for adding Quran Bot!")
        .setDescription(
          "Welcome to the Quran learning community! To get started, an administrator needs to set up the bot."
        )
        .setColor(0x4dabf7)
        .addFields(
          {
            name: "🔧 Setup Required",
            value:
              "Use `/setup-guild` to register this server and configure settings.",
            inline: false,
          },
          {
            name: "📚 Getting Started",
            value:
              "After setup, users can use `/register` to create accounts and `/onboarding` for a guided tour.",
            inline: false,
          },
          {
            name: "🆘 Need Help?",
            value:
              "Visit our documentation or join our support server for assistance.",
            inline: false,
          }
        )
        .setFooter({
          text: "Only administrators can run the setup command",
        })
        .setTimestamp();

      await systemChannel.send({ embeds: [welcomeEmbed] });
    }
  } catch (error) {
    console.error(`Error handling guild join for ${guild.name}:`, error);
  }
});

// Handle guild leave events
client.on("guildDelete", async (guild) => {
  console.log(`Left guild: ${guild.name} (${guild.id})`);

  // Note: We don't automatically delete guild data in case the bot is re-invited
  // Guild data will remain in the database for potential future use
});

// Log in to Discord with your client's token
client.login(token);
