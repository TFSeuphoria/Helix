const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');
const configManager = require('../config.js');

const PROMOTION_ROLES = [
  { label: 'General Manager', roleKey: 'general manager' },
  { label: 'Head Coach', roleKey: 'head coach' },
  { label: 'Assistant Coach', roleKey: 'assistant coach' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Promote a user to a position in your team.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to promote')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages), // we'll check franchise owner role below

  async execute(interaction) {
    const guildConfig = configManager.ensureGuildConfig(interaction.guild.id);
    const franchiseOwnerRoleId = guildConfig.roles?.['franchise owner'];
    const transactionsChannelId = guildConfig.channels?.transactions;

    if (!franchiseOwnerRoleId) {
      return interaction.reply({ content: '❌ Franchise owner role is not set up.', ephemeral: true });
    }

    if (!interaction.member.roles.cache.has(franchiseOwnerRoleId)) {
      return interaction.reply({ content: '❌ Only franchise owners can use this command.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.guild.members.cache.get(targetUser.id);

    if (!targetMember) {
      return interaction.reply({ content: '❌ That user is not in this server.', ephemeral: true });
    }

    // Find the team roles the franchise owner has
    const ownerTeamRoles = interaction.member.roles.cache.filter(r =>
      Object.values(guildConfig.roles).includes(r.id) === false && r.id !== franchiseOwnerRoleId
    );

    // The above filter removes standard config roles like commissioner, franchise owner, etc.
    // We want to identify the team role the owner has.

    // Alternatively, check their roles against teams from teams.json:
    // Since you have teams.js, better to import it and get teams for guild
    const teamsManager = require('../teams.js');
    const teams = teamsManager.getTeams(interaction.guild.id);

    // Find which team roles the owner has
    const ownerTeamRoleIds = teams
      .map(t => t.roleId)
      .filter(roleId => interaction.member.roles.cache.has(roleId));

    if (ownerTeamRoleIds.length === 0) {
      return interaction.reply({ content: '❌ You do not have any team roles assigned.', ephemeral: true });
    }

    // Check if target user shares any of these team roles
    const targetTeamRoles = teams
      .map(t => t.roleId)
      .filter(roleId => targetMember.roles.cache.has(roleId));

    const sharedTeamRoleId = ownerTeamRoleIds.find(roleId => targetTeamRoles.includes(roleId));

    if (!sharedTeamRoleId) {
      return interaction.reply({
        content: '❌ You can only promote users who share your team role.',
        ephemeral: true,
      });
    }

    // Get the role object for the shared team role (for logging)
    const sharedTeamRole = interaction.guild.roles.cache.get(sharedTeamRoleId);

    // Build the promotion select menu
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('promotion_select')
      .setPlaceholder('Select a promotion role')
      .addOptions(
        PROMOTION_ROLES.map(r => ({
          label: r.label,
          value: r.roleKey,
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: `Select the promotion role for **${targetUser.tag}**:`,
      components: [row],
      ephemeral: true,
    });

    // Collector for the dropdown selection
    const filter = i => i.user.id === interaction.user.id && i.customId === 'promotion_select';

    try {
      const collected = await interaction.channel.awaitMessageComponent({
        filter,
        componentType: ComponentType.StringSelect,
        time: 60_000,
      });

      const selectedRoleKey = collected.values[0];
      const promotionRoleName = PROMOTION_ROLES.find(r => r.roleKey === selectedRoleKey).label;

      // Check if role exists in config and guild
      const promotionRoleId = guildConfig.roles?.[selectedRoleKey];
      if (!promotionRoleId) {
        await collected.update({ content: `❌ The role **${promotionRoleName}** is not set up in the config.`, components: [], ephemeral: true });
        return;
      }

      const promotionRole = interaction.guild.roles.cache.get(promotionRoleId);
      if (!promotionRole) {
        await collected.update({ content: `❌ The role **${promotionRoleName}** does not exist in this server.`, components: [], ephemeral: true });
        return;
      }

      // Add the promotion role to target user
      await targetMember.roles.add(promotionRoleId);

      // Send DM to promoted user
      try {
        await targetUser.send(
          `🎉 You have been promoted to **${promotionRoleName}** for team **${sharedTeamRole.name}** in **${interaction.guild.name}**.`
        );
      } catch {
        // ignore DM fail
      }

      // Post to transactions channel
      if (transactionsChannelId) {
        const channel = interaction.guild.channels.cache.get(transactionsChannelId);
        if (channel) {
          const embed = new EmbedBuilder()
            .setTitle('📈 Player Promoted')
            .setColor(0x00ff99)
            .setDescription(
              `**${targetUser.tag}** was promoted to **${promotionRoleName}** for team **${sharedTeamRole.name}**.\nPromoted by: ${interaction.user.tag}`
            )
            .setTimestamp();

          channel.send({ embeds: [embed] }).catch(() => {});
        }
      }

      await collected.update({ content: `✅ Promoted **${targetUser.tag}** to **${promotionRoleName}**.`, components: [], ephemeral: true });
    } catch (e) {
      await interaction.editReply({ content: '❌ Promotion timed out or was cancelled.', components: [], ephemeral: true });
    }
  },
};