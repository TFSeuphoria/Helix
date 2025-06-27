const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const configManager = require('../config.js');
const teamsManager = require('../teams.js');

const COACHING_ROLE_KEYS = ['general manager', 'head coach', 'assistant coach'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('demote')
    .setDescription('Demote a user by removing their coaching roles.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to demote')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages), // franchise owner check inside

  async execute(interaction) {
    const guildConfig = configManager.ensureGuildConfig(interaction.guild.id);
    const franchiseOwnerRoleId = guildConfig.roles?.['franchise owner'];

    if (!franchiseOwnerRoleId) {
      return interaction.reply({ content: '❌ Franchise owner role is not set up.', ephemeral: true });
    }

    if (!interaction.member.roles.cache.has(franchiseOwnerRoleId)) {
      return interaction.reply({ content: '❌ Only franchise owners can use this command.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.guild.members.cache.get(targetUser.id);

    if (!targetMember) {
      return interaction.reply({ content: '❌ That user is not in this server.', ephemeral: true });
    }

    // Find the team roles the franchise owner has
    const teams = teamsManager.getTeams(interaction.guild.id);
    const ownerTeamRoleIds = teams
      .map(t => t.roleId)
      .filter(roleId => interaction.member.roles.cache.has(roleId));

    if (ownerTeamRoleIds.length === 0) {
      return interaction.reply({ content: '❌ You do not have any team roles assigned.', ephemeral: true });
    }

    // Check if target user shares any of these team roles
    const targetTeamRoles = teams
      .map(t => t.roleId)
      .filter(roleId => targetMember.roles.cache.has(roleId));

    const sharedTeamRoleId = ownerTeamRoleIds.find(roleId => targetTeamRoles.includes(roleId));

    if (!sharedTeamRoleId) {
      return interaction.reply({
        content: '❌ You can only demote users who share your team role.',
        ephemeral: true,
      });
    }

    // Remove coaching roles from the target user
    const removedRoles = [];

    for (const roleKey of COACHING_ROLE_KEYS) {
      const roleId = guildConfig.roles?.[roleKey];
      if (roleId && targetMember.roles.cache.has(roleId)) {
        try {
          await targetMember.roles.remove(roleId);
          removedRoles.push(roleKey);
        } catch {
          // ignore individual failures
        }
      }
    }

    if (removedRoles.length === 0) {
      return interaction.reply({ content: '⚠️ That user has no coaching roles to remove.', ephemeral: true });
    }

    return interaction.reply({
      content: `✅ Removed coaching roles (${removedRoles.join(', ')}) from **${targetUser.tag}**.`,
      ephemeral: true,
    });
  },
};