const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const statsPath = path.join(__dirname, '../data/stats.json');

function loadStats() {
  if (!fs.existsSync(statsPath)) fs.writeFileSync(statsPath, '{}');
  return JSON.parse(fs.readFileSync(statsPath, 'utf8'));
}

function saveStats(stats) {
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add_kicker_stats')
    .setDescription('Add kicker stats for a user')
    .addUserOption(option => option.setName('user').setDescription('User to add stats for').setRequired(true))
    .addIntegerOption(option => option.setName('attempts').setDescription('Field Goal Attempts').setRequired(true))
    .addIntegerOption(option => option.setName('made').setDescription('Field Goals Made').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const member = interaction.member;

    // Load config to get commissioner role
    const configPath = path.join(__dirname, '../data/config.json');
    if (!fs.existsSync(configPath)) {
      return interaction.reply({ content: '❌ Config not found.', ephemeral: true });
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const guildConfig = config[guildId];
    if (!guildConfig || !guildConfig.roles || !guildConfig.roles.commissioner) {
      return interaction.reply({ content: '❌ Commissioner role not configured for this guild.', ephemeral: true });
    }
    const commissionerRoleId = guildConfig.roles.commissioner;

    if (!member.roles.cache.has(commissionerRoleId)) {
      return interaction.reply({ content: '❌ You must have the commissioner role to use this command.', ephemeral: true });
    }

    const stats = loadStats();

    if (!stats[guildId]) stats[guildId] = {};
    const userId = interaction.options.getUser('user').id;
    if (!stats[guildId][userId]) {
      stats[guildId][userId] = {};
    }

    const userStats = stats[guildId][userId];
    if (!userStats.kicker) userStats.kicker = {
      attempts: 0,
      made: 0,
    };

    userStats.kicker.attempts += interaction.options.getInteger('attempts');
    userStats.kicker.made += interaction.options.getInteger('made');

    saveStats(stats);

    return interaction.reply({
      content: `✅ Added Kicker stats for ${interaction.options.getUser('user').tag}.`,
      ephemeral: true,
    });
  },
};
