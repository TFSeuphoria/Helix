const {
  SlashCommandBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const configManager = require('../config.js');

const teamsPath = path.join(__dirname, '..', 'data', 'teams.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scorereport')
    .setDescription('Submit game results and stat screenshots.')
    .addAttachmentOption(opt => opt.setName('passing').setDescription('Passing stats screenshot').setRequired(true))
    .addAttachmentOption(opt => opt.setName('runner').setDescription('Rushing stats screenshot').setRequired(true))
    .addAttachmentOption(opt => opt.setName('receiving').setDescription('Receiving stats screenshot').setRequired(true))
    .addAttachmentOption(opt => opt.setName('defender').setDescription('Defense stats screenshot').setRequired(true))
    .addAttachmentOption(opt => opt.setName('coverage').setDescription('Coverage stats screenshot').setRequired(true))
    .addAttachmentOption(opt => opt.setName('kicking').setDescription('Kicking stats screenshot').setRequired(true))
    .addRoleOption(opt => opt.setName('opponent').setDescription('Opponent team role').setRequired(true))
    .addIntegerOption(opt => opt.setName('your_score').setDescription('Your team score').setRequired(true))
    .addIntegerOption(opt => opt.setName('opponent_score').setDescription('Opponent score').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const member = interaction.member;

    // Load config and teams
    const config = configManager.ensureGuildConfig(guildId);
    const resultsChannelId = config.channels?.results;
    if (!resultsChannelId) {
      return interaction.reply({ content: '❌ Results channel not set.', ephemeral: true });
    }

    let teams = {};
    try {
      teams = JSON.parse(fs.readFileSync(teamsPath));
    } catch {
      return interaction.reply({ content: '❌ Could not load teams.json.', ephemeral: true });
    }

    const teamConfig = teams[guildId]?.teams;
    if (!teamConfig || !Array.isArray(teamConfig)) {
      return interaction.reply({ content: '❌ No teams configured for this server.', ephemeral: true });
    }

    // Check if user has a coaching role
    const coachRoles = [
      config.roles['head coach'],
      config.roles['assistant coach'],
      config.roles['general manager'],
      config.roles['franchise owner'],
    ];
    const isCoach = coachRoles.some(r => member.roles.cache.has(r));
    if (!isCoach) {
      return interaction.reply({ content: '❌ You must be a coach to submit a report.', ephemeral: true });
    }

    // Find team user is part of
    const team = teamConfig.find(t => member.roles.cache.has(t.roleId));
    if (!team) {
      return interaction.reply({ content: '❌ You must be on a valid team to submit a report.', ephemeral: true });
    }

    // Get inputs
    const passing = interaction.options.getAttachment('passing');
    const runner = interaction.options.getAttachment('runner');
    const receiving = interaction.options.getAttachment('receiving');
    const defender = interaction.options.getAttachment('defender');
    const coverage = interaction.options.getAttachment('coverage');
    const kicking = interaction.options.getAttachment('kicking');
    const opponent = interaction.options.getRole('opponent');
    const yourScore = interaction.options.getInteger('your_score');
    const opponentScore = interaction.options.getInteger('opponent_score');

    // Create embed
    const embed = {
      title: '📊 Game Report',
      color: 0x00ff99,
      fields: [
        { name: 'Your Team', value: `<@&${team.roleId}>`, inline: true },
        { name: 'Opponent', value: `<@&${opponent.id}>`, inline: true },
        { name: 'Score', value: `${yourScore} - ${opponentScore}`, inline: true },
      ],
      timestamp: new Date(),
    };

    const resultsChannel = interaction.guild.channels.cache.get(resultsChannelId);
    if (!resultsChannel) {
      return interaction.reply({ content: '❌ Results channel not found.', ephemeral: true });
    }

    await resultsChannel.send({
      content: `<@&${team.roleId}> vs <@&${opponent.id}>`,
      embeds: [embed],
      files: [
        new AttachmentBuilder(passing.url).setName('passing.png'),
        new AttachmentBuilder(runner.url).setName('runner.png'),
        new AttachmentBuilder(receiving.url).setName('receiving.png'),
        new AttachmentBuilder(defender.url).setName('defender.png'),
        new AttachmentBuilder(coverage.url).setName('coverage.png'),
        new AttachmentBuilder(kicking.url).setName('kicking.png'),
      ],
    });

    await interaction.reply({ content: '✅ Score report submitted.', ephemeral: true });
  }
};
