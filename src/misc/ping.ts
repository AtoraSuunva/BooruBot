import { SleetSlashCommand } from 'sleetcord'

export const ping = new SleetSlashCommand(
  {
    name: 'ping',
    description: 'Pong! Checks the bot latency',
  },
  {
    run: async function (interaction) {
      const reply = await interaction.reply({
        content: 'Ping?',
        fetchReply: true,
      })

      const wsPing = this.client.ws.ping
      const apiPing = reply.createdTimestamp - interaction.createdTimestamp
      const content = `Pong! **WS**: ${wsPing}ms, **API**: ${apiPing}ms`
      await interaction.editReply(content)
    },
  },
)
