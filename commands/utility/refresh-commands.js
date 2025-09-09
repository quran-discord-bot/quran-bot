import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { PrismaClient } from "../../generated/prisma/index.js";
import { REST, Routes } from "discord.js";

const prisma = new PrismaClient();

export const data = new SlashCommandBuilder()
  .setName("refresh-commands")
  .setDescription(
    "Refresh slash commands for all registered guilds (Bot Owner Only)"
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  try {
    // Check if user is bot owner
    const botOwnerId = process.env.BOT_OWNER_ID;

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

    // Get all registered guilds from database
    const registeredGuilds = await prisma.guild.findMany({
      select: { discordId: true },
    });

    console.log(
      `Found ${registeredGuilds.length} registered guilds to refresh commands for.`
    );

    let successCount = 0;
    let failureCount = 0;
    const results = [];

    // Get all commands from the client
    const commands = [];
    client.commands.forEach((command) => {
      commands.push(command.data.toJSON());
    });

    const rest = new REST().setToken(process.env.BOT_TOKEN);

    // Refresh commands for all registered guilds
    for (const guild of registeredGuilds) {
      try {
        const discordGuild = client.guilds.cache.get(guild.discordId);

        if (discordGuild) {
          const data = await rest.put(
            Routes.applicationGuildCommands(
              process.env.CLIENT_ID,
              guild.discordId
            ),
            { body: commands }
          );

          successCount++;
          results.push(
            `✅ **${discordGuild.name}** - ${data.length} commands refreshed`
          );
          console.log(
            `Refreshed ${data.length} commands for guild: ${discordGuild.name}`
          );
        } else {
          failureCount++;
          results.push(
            `⚠️ **Unknown Guild (${guild.discordId})** - Bot not in guild`
          );
          console.log(`Guild ${guild.discordId} not found in bot cache`);
        }
      } catch (error) {
        failureCount++;
        const guildName =
          client.guilds.cache.get(guild.discordId)?.name || guild.discordId;
        results.push(`❌ **${guildName}** - Error: ${error.message}`);
        console.error(
          `Error refreshing commands for guild ${guild.discordId}:`,
          error
        );
      }
    }

    // Also refresh global commands (just setup-guild)
    try {
      const globalCommands = commands.filter(
        (cmd) => cmd.name === "setup-guild"
      );
      if (globalCommands.length > 0) {
        const globalData = await rest.put(
          Routes.applicationCommands(process.env.CLIENT_ID),
          { body: globalCommands }
        );
        console.log(`Refreshed ${globalData.length} global commands.`);
      }
    } catch (error) {
      console.error("Error refreshing global commands:", error);
    }

    // Create response embed
    const embed = new EmbedBuilder()
      .setTitle("🔄 Command Refresh Complete")
      .setDescription(
        `Refreshed commands for ${registeredGuilds.length} registered guilds.`
      )
      .setColor(successCount > failureCount ? 0x00ff00 : 0xffa500)
      .addFields({
        name: "📊 Summary",
        value: `✅ Successful: ${successCount}\n❌ Failed: ${failureCount}\n📝 Total Commands: ${commands.length}`,
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
    console.error("Error in command refresh:", error);

    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Command Refresh Error")
      .setDescription("Failed to refresh commands. Check console for details.")
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
