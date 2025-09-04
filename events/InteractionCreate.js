import { Events, MessageFlags } from "discord.js";

export const name = Events.InteractionCreate;
export async function execute(interaction) {
  try {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(
          `No command matching ${interaction.commandName} was found.`
        );
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error("Error executing command:", error);

        // Only try to respond if we haven't already
        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: "There was an error while executing this command!",
              ephemeral: true,
            });
          } else {
            await interaction.editReply({
              content: "There was an error while executing this command!",
            });
          }
        } catch (responseError) {
          console.error(
            "Failed to send error response:",
            responseError.message
          );
          // Don't throw here, just log the error
        }
      }
    }
    // ...existing code for other interaction types...
  } catch (error) {
    console.error("Unexpected error in interaction handler:", error);
    // Don't crash the entire bot, just log the error
  }
}
