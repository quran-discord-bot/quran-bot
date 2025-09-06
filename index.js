import fs from "node:fs";
import path from "node:path";
import { Client, Collection, GatewayIntentBits } from "discord.js";
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

// and deploy your commands!
(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      // Routes.applicationCommands(clientId),
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (error) {
    // And of course, make sure you catch and log any errors!
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

// Log in to Discord with your client's token
client.login(token);
