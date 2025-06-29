const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createthread')
    .setDescription('Create a private scheduling thread between two roles.')
    .addRoleOption(option =>
      option.setName('role1')
        .setDescription('First role to include in the thread')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('role2')
        .setDescription('Second role to include in the thread')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: '❌ This command must be used in a server.', ephemeral: true });
    }

    const role1 = interaction.options.getRole('role1');
    const role2 = interaction.options.getRole('role2');

    const parentChannel = interaction.channel;
    if (!parentChannel || !parentChannel.permissionsFor(interaction.guild.members.me).has(PermissionsBitField.Flags.CreatePrivateThreads)) {
      return interaction.reply({ content: '❌ I don’t have permission to create threads in this channel.', ephemeral: true });
    }

    const thread = await parentChannel.threads.create({
      name: `Thread: ${role1.name} vs ${role2.name}`,
      type: ChannelType.PrivateThread,
      invitable: false, // only admins can invite others
      reason: 'Match scheduling thread',
    });

    // Add both roles (Discord doesn't support role mentions in threads directly, so we'll just @ them)
    await thread.send({ content: `${role1} vs ${role2} — please coordinate your matchup here.` });

    // Add members with the roles manually if possible (not guaranteed unless members are cached)
    const membersToAdd = [];
    interaction.guild.members.cache.forEach(member => {
      if (member.roles.cache.has(role1.id) || member.roles.cache.has(role2.id)) {
        membersToAdd.push(member);
      }
    });

    for (const member of membersToAdd) {
      try {
        await thread.members.add(member.id);
      } catch (err) {
        console.warn(`Failed to add ${member.user.tag} to thread: ${err.message}`);
      }
    }

    await interaction.reply({
      content: `✅ Created hidden scheduling thread for ${role1} and ${role2}: <#${thread.id}>`,
      ephemeral: true,
    });
  },
};
