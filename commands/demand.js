const { SlashCommandBuilder } = require('discord.js');
const configManager = require('../config.js');
const teamsManager = require('../teams.js');

const COACHING_ROLE_KEYS = ['general manager', 'head coach', 'assistant coach'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('demand')
    .setDescription('Demand removal from your team and any coaching roles.'),

  async execute(interaction) {
    const guildConfig = configManager.ensureGuildConfig(interaction.guild.id);
    const transactionsChannelId = guildConfig.channels?.transactions;

    const memberRoles = interaction.member.roles.cache;

    // Get all teams for this guild
    const teams = teamsManager.getTeams(interaction.guild.id);
    const teamRoleIds = teams.map(t => t.roleId);

    // Find team role user has
    const userTeamRoleId = memberRoles.find(r => teamRoleIds.includes(r.id));

    if (!userTeamRoleId) {
      return interaction.reply({ content: '❌ You are not part of any team.', ephemeral: true });
    }

    // Remove team role
    try {
      await interaction.member.roles.remove(userTeamRoleId.id);
    } catch (err) {
      return interaction.reply({ content: `❌ Failed to remove your team role: ${err.message}`, ephemeral: true });
    }

    // Remove coaching roles if any
    const removedCoachingRoles = [];
    for (const roleKey of COACHING_ROLE_KEYS) {
      const roleId = guildConfig.roles?.[roleKey];
      if (roleId && memberRoles.has(roleId)) {
        try {
          await interaction.member.roles.remove(roleId);
          removedCoachingRoles.push(roleKey);
        } catch {
          // ignore errors for individual roles
        }
      }
    }

    // Post in transactions channel
    if (transactionsChannelId) {
      const channel = interaction.guild.channels.cache.get(transactionsChannelId);
      if (channel) {
        const teamRoleName = userTeamRoleId.name;

        const msg = `🚨 **${interaction.user.tag}** has demanded removal from team **${teamRoleName}**.`;

        channel.send(msg).catch(() => {});
      }
    }

    return interaction.reply({
      content: `✅ You have been removed from team **${userTeamRoleId.name}**${removedCoachingRoles.length > 0 ? ' and coaching roles' : ''}.`,
      ephemeral: true,
    });
  },
};