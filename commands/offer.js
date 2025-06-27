const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');

const configManager = require('../config.js');
const teamsManager = require('../teams.js');

const COACHING_ROLE_KEYS = ['general manager', 'head coach', 'assistant coach'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('offer')
    .setDescription('Offer a user to join your team.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to offer')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    const guildConfig = configManager.ensureGuildConfig(interaction.guild.id);
    const transactionsChannelId = guildConfig.channels?.transactions;

    // Check if the command user has any coaching role
    const userRoles = interaction.member.roles.cache;
    const hasCoachingRole = COACHING_ROLE_KEYS.some(key => {
      const roleId = guildConfig.roles?.[key];
      return roleId && userRoles.has(roleId);
    });

    if (!hasCoachingRole) {
      return interaction.reply({ content: '❌ Only coaching staff can use this command.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.guild.members.cache.get(targetUser.id);
    if (!targetMember) {
      return interaction.reply({ content: '❌ That user is not in this server.', ephemeral: true });
    }

    // Check if target user already has a team role
    const teams = teamsManager.getTeams(interaction.guild.id);
    const teamRoleIds = teams.map(t => t.roleId);
    const hasTeamRole = targetMember.roles.cache.some(role => teamRoleIds.includes(role.id));
    if (hasTeamRole) {
      return interaction.reply({ content: '❌ That user already has a team role.', ephemeral: true });
    }

    // Find the coaching role of the command user, get the team role linked to it
    // Coaching staff should have exactly one team role
    // Find all team roles user has
    const userTeamRoleIds = teams
      .map(t => t.roleId)
      .filter(roleId => userRoles.has(roleId));

    if (userTeamRoleIds.length === 0) {
      return interaction.reply({ content: '❌ You do not have a team role assigned.', ephemeral: true });
    }

    const teamRoleId = userTeamRoleIds[0]; // assume first team role
    const teamRole = interaction.guild.roles.cache.get(teamRoleId);
    if (!teamRole) {
      return interaction.reply({ content: '❌ Your team role is invalid.', ephemeral: true });
    }

    // Build the DM embed
    const embed = new EmbedBuilder()
      .setTitle('Team Offer')
      .setDescription(`The team **${teamRole.name}** has offered you to join them in **${interaction.guild.name}**!`)
      .setColor(0x00ff99)
      .setTimestamp();

    // Buttons for Accept and Decline
    const acceptButton = new ButtonBuilder()
      .setCustomId('offer_accept')
      .setLabel('Accept')
      .setStyle(ButtonStyle.Success);

    const declineButton = new ButtonBuilder()
      .setCustomId('offer_decline')
      .setLabel('Decline')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(acceptButton, declineButton);

    // Send DM with buttons
    let dmMessage;
    try {
      dmMessage = await targetUser.send({ embeds: [embed], components: [row] });
    } catch {
      return interaction.reply({ content: '❌ Could not DM this user.', ephemeral: true });
    }

    await interaction.reply({ content: `✅ Offer sent to ${targetUser.tag}.`, ephemeral: true });

    // Collector filter
    const filter = i => i.user.id === targetUser.id && (i.customId === 'offer_accept' || i.customId === 'offer_decline');

    // Await button interaction for 2 minutes max
    try {
      const collected = await dmMessage.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 120000 });

      if (collected.customId === 'offer_accept') {
        // Add team role to user
        await targetMember.roles.add(teamRoleId);

        // Post in transactions channel
        if (transactionsChannelId) {
          const channel = interaction.guild.channels.cache.get(transactionsChannelId);
          if (channel) {
            const memberCount = channel.guild.members.cache.filter(m => m.roles.cache.has(teamRoleId)).size;

            const txEmbed = new EmbedBuilder()
              .setTitle('🤝 Team Offer Accepted')
              .setColor(0x00ff99)
              .setDescription(
                `**${targetUser.tag}** accepted an offer to join **${teamRole.name}**.\nOffered by: ${interaction.user.tag}\nMembers now in team: ${memberCount}`
              )
              .setTimestamp();

            channel.send({ embeds: [txEmbed] }).catch(() => {});
          }
        }

        await collected.update({ content: `✅ You accepted the offer to join **${teamRole.name}**!`, components: [] });
      } else if (collected.customId === 'offer_decline') {
        await collected.update({ content: 'You declined the offer.', components: [] });
      }
    } catch {
      // Timeout or no response
      try {
        await dmMessage.edit({ content: 'Offer expired (no response).', components: [] });
      } catch {}
    }
  },
};