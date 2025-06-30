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
    .setName('add_db_stats')
    .setDescription('Add defensive back stats for a user')
    .addUserOption(option => option.setName('user').setDescription('User to add stats for').setRequired(true))
    .addIntegerOption(option => option.setName('targets').setDescription('Targets').setRequired(true))
    .addIntegerOption(option => option.setName('swats').setDescription('Swats').setRequired(true))
    .addIntegerOption(option => option.setName('completions_allowed').setDescription('Completions Allowed').setRequired(true))
    .addIntegerOption(option => option.setName('picks_caught').setDescription('Picks Caught').setRequired(true))
    .addIntegerOption(option => option.setName('pick_6s').setDescription('Pick 6s').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages), // will check commissioner below

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const member = interaction.member;

    // Check commissioner role by raw role ID from your config JSON file (manual read)
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

    // Load existing stats
    const stats = loadStats();

    if (!stats[guildId]) stats[guildId] = {};
    if (!stats[guildId][interaction.options.getUser('user').id]) {
      stats[guildId][interaction.options.getUser('user').id] = {};
    }

    const userStats = stats[guildId][interaction.options.getUser('user').id];
    if (!userStats.db) userStats.db = {
      targets: 0,
      swats: 0,
      completions_allowed: 0,
      picks_caught: 0,
      pick_6s: 0,
    };

    // Add to existing stats, don’t overwrite
    userStats.db.targets += interaction.options.getInteger('targets');
    userStats.db.swats += interaction.options.getInteger('swats');
    userStats.db.completions_allowed += interaction.options.getInteger('completions_allowed');
    userStats.db.picks_caught += interaction.options.getInteger('picks_caught');
    userStats.db.pick_6s += interaction.options.getInteger('pick_6s');

    saveStats(stats);

    return interaction.reply({
      content: `✅ Added DB stats for ${interaction.options.getUser('user').tag}.`,
      ephemeral: true,
    });
  },
};
