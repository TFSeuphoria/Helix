const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const configManager = require('../config.js');
const teamsManager = require('../teams.js');

const COACHING_ROLE_KEYS = ['general manager', 'head coach', 'assistant coach'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('release')
    .setDescription('Release a player from your team and remove their coaching roles.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to release')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages), // check roles below

  async execute(interaction) {
    const guildConfig = configManager.ensureGuildConfig(interaction.guild.id);
    const transactionsChannelId = guildConfig.channels?.transactions;

    // Check if command user has coaching role
    const memberRoles = interaction.member.roles.cache;
    const hasCoachingRole = COACHING_ROLE_KEYS.some(key => {
      const roleId = guildConfig.roles?.[key];
      return roleId && memberRoles.has(roleId);
    });

    if (!hasCoachingRole) {
      return interaction.reply({ content: '❌ Only coaching staff can run this command.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.guild.members.cache.get(targetUser.id);
    if (!targetMember) {
      return interaction.reply({ content: '❌ That user is not in this server.', ephemeral: true });
    }

    // Load teams
    const teams = teamsManager.getTeams(interaction.guild.id);
    const teamRoleIds = teams.map(t => t.roleId);

    // Find coach's team role(s)
    const coachTeamRoleIds = teamRoleIds.filter(roleId => memberRoles.has(roleId));
    if (coachTeamRoleIds.length === 0) {
      return interaction.reply({ content: '❌ You do not have a team role assigned.', ephemeral: true });
    }

    // Check if target user shares same team role as coach
    const targetHasTeamRole = coachTeamRoleIds.find(roleId => targetMember.roles.cache.has(roleId));
    if (!targetHasTeamRole) {
      return interaction.reply({ content: '❌ You can only release players on your own team.', ephemeral: true });
    }

    // Remove coaching roles from target user
    for (const roleKey of COACHING_ROLE_KEYS) {
      const roleId = guildConfig.roles?.[roleKey];
      if (roleId && targetMember.roles.cache.has(roleId)) {
        try {
          await targetMember.roles.remove(roleId);
        } catch {
          // ignore individual role removal errors
        }
      }
    }

    // Remove team role from target user
    try {
      await targetMember.roles.remove(targetHasTeamRole);
    } catch (err) {
      return interaction.reply({ content: `❌ Failed to remove team role: ${err.message}`, ephemeral: true });
    }

    // Post to transactions channel
    if (transactionsChannelId) {
      const channel = interaction.guild.channels.cache.get(transactionsChannelId);
      if (channel) {
        const teamRole = interaction.guild.roles.cache.get(targetHasTeamRole);
        const embed = new EmbedBuilder()
          .setTitle('❌ Player Released')
          .setColor(0xff3300)
          .setDescription(
            `**${targetUser.tag}** was released from team **${teamRole ? teamRole.name : 'Unknown'}**.\nReleased by: ${interaction.user.tag}`
          )
          .setTimestamp();

        channel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    return interaction.reply({ content: `✅ Released **${targetUser.tag}** from your team.`, ephemeral: true });
  },
};