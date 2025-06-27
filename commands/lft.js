const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const configManager = require('../config.js');
const teamsManager = require('../teams.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lft')
    .setDescription('Pitch yourself to teams in the free agency channel.')
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Describe yourself and why teams should sign you')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const member = interaction.member;

    const guildConfig = configManager.ensureGuildConfig(guildId);
    const guildTeams = teamsManager.ensureGuildTeams(guildId);

    // Check if user already has a team role
    const teamRoleIds = Object.values(guildTeams).map(team => team.role);
    const hasTeam = teamRoleIds.some(roleId => member.roles.cache.has(roleId));

    if (hasTeam) {
      return interaction.reply({ content: '❌ You already belong to a team and cannot use this command.', ephemeral: true });
    }

    const freeAgencyChannelId = guildConfig.channels?.['free agency'];
    if (!freeAgencyChannelId) {
      return interaction.reply({ content: '❌ Free agency channel is not set up.', ephemeral: true });
    }

    const freeAgencyChannel = interaction.guild.channels.cache.get(freeAgencyChannelId);
    if (!freeAgencyChannel) {
      return interaction.reply({ content: '❌ Could not find the free agency channel.', ephemeral: true });
    }

    const description = interaction.options.getString('description');

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle('📢 Looking For Team')
      .setDescription(description)
      .setFooter({ text: `Player: ${interaction.user.tag}` })
      .setColor(0x00b0f4)
      .setTimestamp();

    // DM Player button
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`dm_player_${interaction.user.id}`)
          .setLabel('DM Player')
          .setStyle(ButtonStyle.Primary),
      );

    // Send to free agency channel
    await freeAgencyChannel.send({ embeds: [embed], components: [row] });

    return interaction.reply({ content: '✅ Your LFT message has been posted.', ephemeral: true });
  },

  // Button handler to DM the player when a team clicks "DM Player"
  async handleButton(interaction) {
    if (!interaction.isButton()) return false;

    // Check if button is a DM Player button
    if (!interaction.customId.startsWith('dm_player_')) return false;

    const playerId = interaction.customId.replace('dm_player_', '');

    // Fetch user
    try {
      const user = await interaction.client.users.fetch(playerId);
      if (!user) throw new Error('User not found');

      // Send DM
      await user.send(`📩 You have a team interested in you in **${interaction.guild.name}**. Reply here to connect!`);

      await interaction.reply({ content: `✅ DM sent to <@${playerId}>`, ephemeral: true });
    } catch (error) {
      console.error('Error DMing player:', error);
      await interaction.reply({ content: '❌ Failed to send DM to the player.', ephemeral: true });
    }

    return true;
  }
};