const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const configManager = require('../config.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stream')
    .setDescription('Announce a stream between two teams.')
    .addStringOption(option =>
      option.setName('team1')
        .setDescription('Name of the first team')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('team2')
        .setDescription('Name of the second team')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('link')
        .setDescription('Link to the stream')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    const guildConfig = configManager.ensureGuildConfig(interaction.guild.id);

    const streamerRoleId = guildConfig.roles?.['streamer'];
    const streamPingRoleId = guildConfig.roles?.['stream ping'];
    const streamsChannelId = guildConfig.channels?.streams;

    if (!streamerRoleId || !streamsChannelId) {
      return interaction.reply({ content: '❌ Streamer role or streams channel not set up.', ephemeral: true });
    }

    if (!interaction.member.roles.cache.has(streamerRoleId)) {
      return interaction.reply({ content: '❌ Only users with the **Streamer** role can use this command.', ephemeral: true });
    }

    const team1 = interaction.options.getString('team1');
    const team2 = interaction.options.getString('team2');
    const link = interaction.options.getString('link');

    const streamChannel = interaction.guild.channels.cache.get(streamsChannelId);
    if (!streamChannel) {
      return interaction.reply({ content: '❌ Streams channel not found in this server.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('📺 Stream Live')
      .setColor(0x9146ff) // Twitch purple, feel free to change
      .addFields(
        { name: 'Matchup', value: `**${team1}** vs **${team2}**`, inline: true },
        { name: 'Streamed By', value: interaction.user.tag, inline: true },
        { name: 'Stream Link', value: `[Click to Watch](${link})`, inline: false }
      )
      .setTimestamp();

    // Send the message to the streams channel
    const mention = streamPingRoleId ? `<@&${streamPingRoleId}>` : '';
    streamChannel.send({ content: `${mention}`, embeds: [embed] });

    return interaction.reply({ content: '✅ Stream posted to the streams channel.', ephemeral: true });
  }
};