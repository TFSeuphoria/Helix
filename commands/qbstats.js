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
    .setName('add_qb_stats')
    .setDescription('Add quarterback stats for a user')
    .addUserOption(option => option.setName('user').setDescription('User to add stats for').setRequired(true))
    .addIntegerOption(option => option.setName('passing_yards').setDescription('Passing Yards').setRequired(true))
    .addIntegerOption(option => option.setName('passing_tds').setDescription('Passing TDs').setRequired(true))
    .addIntegerOption(option => option.setName('interceptions').setDescription('Interceptions Thrown').setRequired(true))
    .addIntegerOption(option => option.setName('sacks_taken').setDescription('Sacks Taken').setRequired(true))
    .addIntegerOption(option => option.setName('passing_attempts').setDescription('Passing Attempts').setRequired(true))
    .addIntegerOption(option => option.setName('passing_completions').setDescription('Passing Completions').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages), // will manually check commissioner

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
    if (!userStats.qb) userStats.qb = {
      passing_yards: 0,
      passing_tds: 0,
      interceptions: 0,
      sacks_taken: 0,
      passing_attempts: 0,
      passing_completions: 0,
    };

    userStats.qb.passing_yards += interaction.options.getInteger('passing_yards');
    userStats.qb.passing_tds += interaction.options.getInteger('passing_tds');
    userStats.qb.interceptions += interaction.options.getInteger('interceptions');
    userStats.qb.sacks_taken += interaction.options.getInteger('sacks_taken');
    userStats.qb.passing_attempts += interaction.options.getInteger('passing_attempts');
    userStats.qb.passing_completions += interaction.options.getInteger('passing_completions');

    saveStats(stats);

    return interaction.reply({
      content: `✅ Added QB stats for ${interaction.options.getUser('user').tag}.`,
      ephemeral: true,
    });
  },
};
