const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const configManager = require('../config.js');

const COACHING_ROLE_KEYS = ['franchise owner', 'general manager', 'head coach', 'assistant coach'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lfp')
    .setDescription('Post a Looking For Player message to the free agency channel.')
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Describe the player you are looking for')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const guildConfig = configManager.ensureGuildConfig(guildId);

    // Check coaching roles
    const coachingRoles = COACHING_ROLE_KEYS.map(key => guildConfig.roles?.[key]).filter(Boolean);
    if (!coachingRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
      return interaction.reply({ content: '❌ Only coaching staff can use this command.', ephemeral: true });
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

    const embed = new EmbedBuilder()
      .setTitle('📢 Looking For Player')
      .setDescription(description)
      .setFooter({ text: `DM Coach: ${interaction.user.tag}` })
      .setColor(0x00b0f4)
      .setTimestamp();

    await freeAgencyChannel.send({ embeds: [embed] });

    return interaction.reply({ content: '✅ Your LFP message has been posted.', ephemeral: true });
  },
};