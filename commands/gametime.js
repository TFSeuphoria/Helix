const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const configManager = require('../config.js');
const teamsManager = require('../teams.js');

const COACHING_ROLE_KEYS = ['franchise owner', 'general manager', 'head coach', 'assistant coach'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gametime')
    .setDescription('Schedule a game between your team and an opponent.')
    .addRoleOption(option =>
      option.setName('opponent_team')
        .setDescription('Team you are playing against')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('time')
        .setDescription('Time of the game')
        .setRequired(true))
    .addBooleanOption(option =>
      option.setName('primetime')
        .setDescription('Is this a primetime game?')
        .setRequired(true))
    .addBooleanOption(option =>
      option.setName('force')
        .setDescription('Was the time forced?')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const guildConfig = configManager.ensureGuildConfig(guildId);
    const guildTeamsData = teamsManager.ensureGuildTeams(guildId);
    const teams = guildTeamsData.teams || [];

    const coachingRoles = COACHING_ROLE_KEYS
      .map(key => guildConfig.roles?.[key])
      .filter(Boolean);

    const streamerRoleId = guildConfig.roles?.['streamer'];
    const refereeRoleId = guildConfig.roles?.['referee'];
    const gametimesChannelId = guildConfig.channels?.gametimes;

    const userRoles = interaction.member.roles.cache;

    // ✅ Check for coaching role
    if (!coachingRoles.some(roleId => userRoles.has(roleId))) {
      return interaction.reply({ content: '❌ Only coaching staff can use this command.', ephemeral: true });
    }

    const opponentTeamRole = interaction.options.getRole('opponent_team');
    const time = interaction.options.getString('time');
    const isPrimetime = interaction.options.getBoolean('primetime');
    const isForced = interaction.options.getBoolean('force') || false;

    // ✅ Find member's team (by roleId match)
    const memberTeam = teams.find(team => userRoles.has(team.roleId));
    if (!memberTeam) {
      return interaction.reply({ content: '❌ You are not assigned to a valid team.', ephemeral: true });
    }

    const opponentTeam = teams.find(team => team.roleId === opponentTeamRole.id);
    if (!opponentTeam) {
      return interaction.reply({ content: '❌ The selected opponent team is not registered in the league.', ephemeral: true });
    }

    const memberTeamName = interaction.guild.roles.cache.get(memberTeam.roleId)?.name || 'Unknown';
    const opponentTeamName = interaction.guild.roles.cache.get(opponentTeam.roleId)?.name || 'Unknown';

    const embed = new EmbedBuilder()
      .setTitle('📅 Scheduled Matchup')
      .setColor(isPrimetime ? 0xffff00 : 0x00b0f4)
      .addFields(
        { name: 'Matchup', value: `**${memberTeamName}** vs **${opponentTeamName}**`, inline: false },
        { name: 'Scheduled Time', value: time, inline: true },
        { name: 'Primetime?', value: isPrimetime ? '🌟 Yes' : 'No', inline: true },
        { name: 'Forced Time?', value: isForced ? '⚠️ Yes' : 'No', inline: true },
        { name: 'Streamer', value: '🎥 *Not assigned*', inline: true },
        { name: 'Referee', value: '🧑‍⚖️ *Not assigned*', inline: true }
      )
      .setFooter({ text: `Scheduled by ${interaction.user.tag}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('assign_streamer')
        .setLabel('🎥 Claim Streamer')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('assign_referee')
        .setLabel('🧑‍⚖️ Claim Referee')
        .setStyle(ButtonStyle.Secondary)
    );

    const gametimesChannel = interaction.guild.channels.cache.get(gametimesChannelId);
    if (!gametimesChannel) {
      return interaction.reply({ content: '❌ Gametimes channel not found.', ephemeral: true });
    }

    await gametimesChannel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: '✅ Game has been scheduled.', ephemeral: true });
  },

  // ✅ Button handler
  async handleButton(interaction) {
    if (!interaction.isButton()) return false;

    const { guild, member, message, customId } = interaction;
    if (!guild) return false;

    const guildConfig = configManager.ensureGuildConfig(guild.id);
    const gametimesChannelId = guildConfig.channels?.gametimes;

    const streamerRoleId = guildConfig.roles?.['streamer'];
    const refereeRoleId = guildConfig.roles?.['referee'];

    if (message.channelId !== gametimesChannelId) return false;

    if (customId !== 'assign_streamer' && customId !== 'assign_referee') return false;

    if (
      (customId === 'assign_streamer' && !member.roles.cache.has(streamerRoleId)) ||
      (customId === 'assign_referee' && !member.roles.cache.has(refereeRoleId))
    ) {
      await interaction.reply({ content: '❌ You don’t have permission to claim this role.', ephemeral: true });
      return true;
    }

    const embed = message.embeds[0];
    if (!embed) {
      await interaction.reply({ content: '❌ Embed missing.', ephemeral: true });
      return true;
    }

    const fields = embed.fields.map(field => ({ ...field }));
    if (customId === 'assign_streamer') {
      const field = fields.find(f => f.name === 'Streamer');
      if (field) field.value = `<@${member.id}>`;
    } else if (customId === 'assign_referee') {
      const field = fields.find(f => f.name === 'Referee');
      if (field) field.value = `<@${member.id}>`;
    }

    const newEmbed = EmbedBuilder.from(embed).setFields(fields);

    try {
      await message.edit({ embeds: [newEmbed] });
      await interaction.reply({ content: `✅ You claimed the ${customId === 'assign_streamer' ? 'Streamer' : 'Referee'} role.`, ephemeral: true });
    } catch (err) {
      console.error('Edit error:', err);
      await interaction.reply({ content: '❌ Failed to update embed.', ephemeral: true });
    }

    return true;
  }
};
