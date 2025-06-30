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
    .setName('add_defender_stats')
    .setDescription('Add defender stats for a user')
    .addUserOption(option => option.setName('user').setDescription('User to add stats for').setRequired(true))
    .addIntegerOption(option => option.setName('tackles').setDescription('Tackles').setRequired(true))
    .addIntegerOption(option => option.setName('misses').setDescription('Misses').setRequired(true))
    .addIntegerOption(option => option.setName('sacks').setDescription('Sacks').setRequired(true))
    .addIntegerOption(option => option.setName('fumbles_forced').setDescription('Fumbles Forced').setRequired(true))
    .addIntegerOption(option => option.setName('fumbles_recovered').setDescription('Fumbles Recovered').setRequired(true))
    .addIntegerOption(option => option.setName('safeties').setDescription('Safeties').setRequired(true))
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
    if (!userStats.defender) userStats.defender = {
      tackles: 0,
      misses: 0,
      sacks: 0,
      fumbles_forced: 0,
      fumbles_recovered: 0,
      safeties: 0,
    };

    userStats.defender.tackles += interaction.options.getInteger('tackles');
    userStats.defender.misses += interaction.options.getInteger('misses');
    userStats.defender.sacks += interaction.options.getInteger('sacks');
    userStats.defender.fumbles_forced += interaction.options.getInteger('fumbles_forced');
    userStats.defender.fumbles_recovered += interaction.options.getInteger('fumbles_recovered');
    userStats.defender.safeties += interaction.options.getInteger('safeties');

    saveStats(stats);

    return interaction.reply({
      content: `✅ Added Defender stats for ${interaction.options.getUser('user').tag}.`,
      ephemeral: true,
    });
  },
};
