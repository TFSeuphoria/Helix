const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const configManager = require('../config.js');

const COACHING_ROLE_KEYS = [
  'franchise owner',
  'general manager',
  'head coach',
  'assistant coach',
];

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
    const guildId = interaction.guild.id;
    const config = configManager.ensureGuildConfig(guildId);
    const transactionsChannelId = config.channels?.transactions;

    const teamsPath = path.join(__dirname, '../data/teams.json');
    if (!fs.existsSync(teamsPath)) {
      return interaction.reply({ content: '❌ Teams data not found.', ephemeral: true });
    }

    const teamsData = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));
    const guildTeams = teamsData[guildId]?.teams || [];

    const userRoles = interaction.member.roles.cache;

    // Check if user has any coaching staff role
    const hasCoachRole = COACHING_ROLE_KEYS.some(key => {
      const roleId = config.roles?.[key];
      return roleId && userRoles.has(roleId);
    });

    if (!hasCoachRole) {
      return interaction.reply({ content: '❌ Only coaching staff can use this command.', ephemeral: true });
    }

    // Check if user has a team role from teams.json
    const userTeam = guildTeams.find(team => userRoles.has(team.roleId));
    if (!userTeam) {
      return interaction.reply({ content: '❌ You do not have a team role assigned.', ephemeral: true });
    }

    const teamRoleId = userTeam.roleId;
    const teamRole = interaction.guild.roles.cache.get(teamRoleId);
    if (!teamRole) {
      return interaction.reply({ content: '❌ Your team role is invalid or missing from this server.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.guild.members.cache.get(targetUser.id);
    if (!targetMember) {
      return interaction.reply({ content: '❌ That user is not in this server.', ephemeral: true });
    }

    // Check if target already has a team role
    const alreadyOnTeam = targetMember.roles.cache.some(role =>
      guildTeams.some(team => team.roleId === role.id)
    );

    if (alreadyOnTeam) {
      return interaction.reply({ content: '❌ That user already has a team role.', ephemeral: true });
    }

    // Build offer DM
    const offerEmbed = new EmbedBuilder()
      .setTitle('Team Offer')
      .setDescription(`**${teamRole.name}** has offered you to join them in **${interaction.guild.name}**!`)
      .setColor(0x00ff99)
      .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('offer_accept').setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('offer_decline').setLabel('Decline').setStyle(ButtonStyle.Danger)
    );

    let dm;
    try {
      dm = await targetUser.send({ embeds: [offerEmbed], components: [buttons] });
    } catch {
      return interaction.reply({ content: '❌ Could not DM this user.', ephemeral: true });
    }

    await interaction.reply({ content: `✅ Offer sent to ${targetUser.tag}.`, ephemeral: true });

    try {
      const response = await dm.awaitMessageComponent({
        filter: i => i.user.id === targetUser.id,
        componentType: ComponentType.Button,
        time: 120_000,
      });

      if (response.customId === 'offer_accept') {
        await targetMember.roles.add(teamRoleId);

        if (transactionsChannelId) {
          const txChannel = interaction.guild.channels.cache.get(transactionsChannelId);
          if (txChannel) {
            const membersOnTeam = interaction.guild.members.cache.filter(m =>
              m.roles.cache.has(teamRoleId)
            ).size;

            const txEmbed = new EmbedBuilder()
              .setTitle('🤝 Offer Accepted')
              .setColor(0x00ff99)
              .setDescription(`**${targetUser.tag}** joined **${teamRole.name}**\nOffered by: ${interaction.user.tag}\nTeam now has ${membersOnTeam} members.`)
              .setTimestamp();

            await txChannel.send({ embeds: [txEmbed] });
          }
        }

        await response.update({ content: `✅ You accepted the offer to join **${teamRole.name}**!`, components: [] });
      } else {
        await response.update({ content: '❌ You declined the offer.', components: [] });
      }
    } catch {
      await dm.edit({ content: '⌛ Offer expired. No response received.', components: [] }).catch(() => {});
    }
  },
};
