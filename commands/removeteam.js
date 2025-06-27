const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const teamsManager = require('../teams.js');
const configManager = require('../config.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeteam')
    .setDescription('Remove a team by role.')
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('The team role to remove')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages), // but check commissioner role below

  async execute(interaction) {
    const guildConfig = configManager.ensureGuildConfig(interaction.guild.id);
    const commissionerRoleId = guildConfig.roles?.commissioner;

    if (!commissionerRoleId) {
      return interaction.reply({ content: '❌ Commissioner role is not set up yet.', ephemeral: true });
    }

    if (!interaction.member.roles.cache.has(commissionerRoleId)) {
      return interaction.reply({ content: '❌ You must have the commissioner role to use this command.', ephemeral: true });
    }

    const role = interaction.options.getRole('role');

    const removed = teamsManager.removeTeam(interaction.guild.id, role.id);

    if (removed) {
      return interaction.reply({ content: `✅ Removed team ${role.name}`, ephemeral: true });
    } else {
      return interaction.reply({ content: `❌ Team with role ${role.name} not found.`, ephemeral: true });
    }
  },
};