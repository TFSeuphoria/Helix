const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const teamsManager = require('../teams.js');
const configManager = require('../config.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addteam')
    .setDescription('Add a team role and emoji to the teams list.')
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('The team role to add')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('emoji')
        .setDescription('The emoji representing the team')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages), // but check commissioner role below

  async execute(interaction) {
    // Check if user has commissioner role from config
    const guildConfig = configManager.ensureGuildConfig(interaction.guild.id);
    const commissionerRoleId = guildConfig.roles?.commissioner;

    if (!commissionerRoleId) {
      return interaction.reply({ content: '❌ Commissioner role is not set up yet.', ephemeral: true });
    }

    if (!interaction.member.roles.cache.has(commissionerRoleId)) {
      return interaction.reply({ content: '❌ You must have the commissioner role to use this command.', ephemeral: true });
    }

    const role = interaction.options.getRole('role');
    const emoji = interaction.options.getString('emoji');

    try {
      teamsManager.addTeam(interaction.guild.id, {
        roleId: role.id,
        emoji,
      });
      return interaction.reply({ content: `✅ Added team ${role.name} with emoji ${emoji}`, ephemeral: true });
    } catch (error) {
      return interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
    }
  },
};