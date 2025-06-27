const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const configManager = require('../config.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('appoint')
    .setDescription('Appoint a user as franchise owner for a team.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to appoint')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('team')
        .setDescription('Team role to assign')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages), // commissioner role check below

  async execute(interaction) {
    const guildConfig = configManager.ensureGuildConfig(interaction.guild.id);
    const commissionerRoleId = guildConfig.roles?.commissioner;
    const franchiseOwnerRoleId = guildConfig.roles?.['franchise owner'];
    const transactionsChannelId = guildConfig.channels?.transactions;

    if (!commissionerRoleId) {
      return interaction.reply({ content: '❌ Commissioner role is not set up yet.', ephemeral: true });
    }

    if (!interaction.member.roles.cache.has(commissionerRoleId)) {
      return interaction.reply({ content: '❌ You must have the commissioner role to run this command.', ephemeral: true });
    }

    if (!franchiseOwnerRoleId) {
      return interaction.reply({ content: '❌ Franchise owner role is not set up yet.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const member = interaction.guild.members.cache.get(user.id);
    if (!member) {
      return interaction.reply({ content: '❌ That user is not in this server.', ephemeral: true });
    }

    const teamRole = interaction.options.getRole('team');

    try {
      // Add franchise owner role
      await member.roles.add(franchiseOwnerRoleId);

      // Add the team role
      await member.roles.add(teamRole.id);
    } catch (err) {
      return interaction.reply({ content: `❌ Failed to assign roles: ${err.message}`, ephemeral: true });
    }

    // Send DM to the appointed user
    try {
      await user.send(
        `👋 You have been appointed as **Franchise Owner** of the team **${teamRole.name}** in **${interaction.guild.name}**.`
      );
    } catch {
      // DM fail is not fatal
    }

    // Post in transactions channel if set
    if (transactionsChannelId) {
      const channel = interaction.guild.channels.cache.get(transactionsChannelId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('📢 Franchise Owner Appointed')
          .setColor(0x00ff99)
          .setDescription(
            `**${user.tag}** has been appointed as Franchise Owner of **${teamRole.name}**.\nAppointed by: ${interaction.user.tag}`
          )
          .setTimestamp();

        channel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    return interaction.reply({ content: `✅ ${user.tag} was appointed franchise owner of ${teamRole.name}.`, ephemeral: true });
  },
};