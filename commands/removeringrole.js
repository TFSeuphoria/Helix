const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'ringroles.json');

module.exports = {
  data: {
    name: 'removeringrole',
    description: 'Removes a ring role (commissioner only)',
    options: [
      {
        name: 'role',
        description: 'Role to remove from ring roles',
        type: 8, // Role type
        required: true,
      },
    ],
  },

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      // Replace with your commissioner check
      return interaction.reply({ content: 'Only commissioners can remove ring roles.', ephemeral: true });
    }

    const role = interaction.options.getRole('role');
    if (!role) return interaction.reply({ content: 'Role not found.', ephemeral: true });

    let ringroles = {};
    try {
      if (fs.existsSync(filePath)) {
        ringroles = JSON.parse(fs.readFileSync(filePath));
      }
    } catch (error) {
      console.error('Error reading ringroles.json:', error);
      return interaction.reply({ content: 'Error reading ringroles file.', ephemeral: true });
    }

    if (!ringroles[interaction.guildId] || !ringroles[interaction.guildId].includes(role.id)) {
      return interaction.reply({ content: 'This role is not a ring role.', ephemeral: true });
    }

    ringroles[interaction.guildId] = ringroles[interaction.guildId].filter(rid => rid !== role.id);

    try {
      fs.writeFileSync(filePath, JSON.stringify(ringroles, null, 2));
      return interaction.reply({ content: `Removed ring role: ${role.name} (${role.id})`, ephemeral: true });
    } catch (error) {
      console.error('Error writing ringroles.json:', error);
      return interaction.reply({ content: 'Error saving ring roles.', ephemeral: true });
    }
  },
};
