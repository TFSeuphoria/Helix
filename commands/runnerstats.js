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
    .setName('add_runner_stats')
    .setDescription('Add running back stats for a user')
    .addUserOption(option => option.setName('user').setDescription('User to add stats for').setRequired(true))
    .addIntegerOption(option => option.setName('rushing_attempts').setDescription('Rushing Attempts').setRequired(true))
    .addIntegerOption(option => option.setName('rushing_yards').setDescription('Rushing Yards').setRequired(true))
    .addIntegerOption(option => option.setName('rushing_tds').setDescription('Rushing Touchdowns').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const member = interaction.member;

    // Load config to check commissioner role
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
    if (!stats[guildId][interaction.options.getUser('user').id]) {
      stats[guildId][interaction.options.getUser('user').id] = {};
    }

    const userStats = stats[guildId][interaction.options.getUser('user').id];
    if (!userStats.runner) userStats.runner = {
      rushing_attempts: 0,
      rushing_yards: 0,
      rushing_tds: 0,
    };

    userStats.runner.rushing_attempts += interaction.options.getInteger('rushing_attempts');
    userStats.runner.rushing_yards += interaction.options.getInteger('rushing_yards');
    userStats.runner.rushing_tds += interaction.options.getInteger('rushing_tds');

    saveStats(stats);

    return interaction.reply({
      content: `✅ Added Runner stats for ${interaction.options.getUser('user').tag}.`,
      ephemeral: true,
    });
  },
};
