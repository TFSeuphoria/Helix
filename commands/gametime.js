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
    const guildTeams = teamsManager.ensureGuildTeams(guildId);

    const coachingRoles = COACHING_ROLE_KEYS.map(key => guildConfig.roles?.[key]).filter(Boolean);
    const streamerRoleId = guildConfig.roles?.['streamer'];
    const refereeRoleId = guildConfig.roles?.['referee'];
    const gametimesChannelId = guildConfig.channels?.gametimes;

    // Check if user has a coaching role
    const userRoles = interaction.member.roles.cache;
    if (!coachingRoles.some(roleId => userRoles.has(roleId))) {
      return interaction.reply({ content: '❌ Only coaching staff can use this command.', ephemeral: true });
    }

    const opponentTeam = interaction.options.getRole('opponent_team');
    const time = interaction.options.getString('time');
    const isPrimetime = interaction.options.getBoolean('primetime');
    const isForced = interaction.options.getBoolean('force') || false;

    const memberTeamName = Object.keys(guildTeams).find(teamName => {
      const teamRoleId = guildTeams[teamName].role;
      return userRoles.has(teamRoleId);
    });

    if (!memberTeamName) {
      return interaction.reply({ content: '❌ You are not assigned to a valid team.', ephemeral: true });
    }

    const memberTeamData = guildTeams[memberTeamName];
    const opponentTeamData = Object.values(guildTeams).find(t => t.role === opponentTeam.id);

    if (!opponentTeamData) {
      return interaction.reply({ content: '❌ The selected opponent team is not registered in the league.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('📅 Scheduled Matchup')
      .setColor(isPrimetime ? 0xffff00 : 0x00b0f4)
      .addFields(
        { name: 'Matchup', value: `**${memberTeamName}** vs **${Object.keys(guildTeams).find(k => guildTeams[k].role === opponentTeam.id)}**`, inline: false },
        { name: 'Scheduled Time', value: time, inline: true },
        { name: 'Primetime?', value: isPrimetime ? '🌟 Yes' : 'No', inline: true },
        { name: 'Forced Time?', value: isForced ? '⚠️ Yes' : 'No', inline: true },
        { name: 'Streamer', value: '🎥 *Not assigned*', inline: true },
        { name: 'Referee', value: '🧑‍⚖️ *Not assigned*', inline: true }
      )
      .setFooter({ text: `Scheduled by ${interaction.user.tag}` })
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('assign_streamer')
          .setLabel('🎥 Claim Streamer')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('assign_referee')
          .setLabel('🧑‍⚖️ Claim Referee')
          .setStyle(ButtonStyle.Secondary),
      );

    const gametimesChannel = interaction.guild.channels.cache.get(gametimesChannelId);
    if (!gametimesChannel) {
      return interaction.reply({ content: '❌ Gametimes channel not found.', ephemeral: true });
    }

    const message = await gametimesChannel.send({ embeds: [embed], components: [row] });

    await interaction.reply({ content: '✅ Game has been scheduled.', ephemeral: true });

    // Store the message ID and guild ID to handle button clicks (optional persistence if needed)
    // For now, no DB storage — just handle clicks live
  },

  // Button handler method — call this from your main index.js interactionCreate event
  async handleButton(interaction) {
    if (!interaction.isButton()) return false;

    const { guild, member, message, customId } = interaction;
    if (!guild) return false;

    const guildConfig = configManager.ensureGuildConfig(guild.id);

    const streamerRoleId = guildConfig.roles?.['streamer'];
    const refereeRoleId = guildConfig.roles?.['referee'];

    // Only process buttons in gametimes channel
    if (message.channelId !== guildConfig.channels?.gametimes) return false;

    if (customId !== 'assign_streamer' && customId !== 'assign_referee') return false;

    // Permission check
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

    // Update fields (clone)
    const fields = embed.fields.map(f => ({ ...f }));

    if (customId === 'assign_streamer') {
      fields.forEach(field => {
        if (field.name === 'Streamer') {
          field.value = `<@${member.id}>`;
        }
      });
    } else if (customId === 'assign_referee') {
      fields.forEach(field => {
        if (field.name === 'Referee') {
          field.value = `<@${member.id}>`;
        }
      });
    }

    const newEmbed = EmbedBuilder.from(embed).setFields(fields);

    try {
      await message.edit({ embeds: [newEmbed] });
      await interaction.reply({ content: `✅ You have claimed the ${customId === 'assign_streamer' ? 'Streamer' : 'Referee'} role for this game.`, ephemeral: true });
    } catch (error) {
      console.error('Failed to update gametime embed:', error);
      await interaction.reply({ content: '❌ Failed to update game info.', ephemeral: true });
    }

    return true;
  }
};