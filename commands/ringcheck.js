const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'ringroles.json');

module.exports = {
  data: {
    name: 'ringcheck',
    description: 'Check how many ring roles a user has in this server and total',
    options: [
      {
        name: 'user',
        description: 'User to check',
        type: 6, // User type
        required: false,
      },
    ],
  },

  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    let ringroles = {};

    try {
      if (fs.existsSync(filePath)) {
        ringroles = JSON.parse(fs.readFileSync(filePath));
      }
    } catch (error) {
      console.error('Error reading ringroles.json:', error);
      return interaction.reply({ content: 'Error reading ringroles file.', ephemeral: true });
    }

    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'User not found in this server.', ephemeral: true });

    // Count rings in this server
    const guildRingRoles = ringroles[guild.id] || [];
    const memberRingRoles = member.roles.cache.filter(r => guildRingRoles.includes(r.id));
    const ringsInServer = memberRingRoles.size;

    // Count rings total across all guilds where the user shares and ring roles exist
    let totalRings = 0;
    if (interaction.client.guilds.cache.size && ringroles) {
      for (const [guildId, roles] of Object.entries(ringroles)) {
        const g = interaction.client.guilds.cache.get(guildId);
        if (!g) continue;
        const m = await g.members.fetch(user.id).catch(() => null);
        if (!m) continue;
        totalRings += m.roles.cache.filter(r => roles.includes(r.id)).size;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`Ring Check for ${user.tag}`)
      .addFields(
        { name: 'Rings in this server', value: ringsInServer.toString(), inline: true },
        { name: 'Total rings across servers', value: totalRings.toString(), inline: true },
      )
      .setColor('#00FFFF')
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
