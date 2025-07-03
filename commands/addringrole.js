const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'ringroles.json');

module.exports = {
  data: {
    name: 'addringrole',
    description: 'Adds a ring role (commissioner only)',
    options: [
      {
        name: 'role',
        description: 'Role to add as a ring role',
        type: 8, // Role type
        required: true,
      },
    ],
  },

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      // Replace this with your commissioner check logic
      return interaction.reply({ content: 'Only commissioners can add ring roles.', ephemeral: true });
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

    if (!ringroles[interaction.guildId]) {
      ringroles[interaction.guildId] = [];
    }

    if (ringroles[interaction.guildId].includes(role.id)) {
      return interaction.reply({ content: 'This role is already a ring role.', ephemeral: true });
    }

    ringroles[interaction.guildId].push(role.id);

    try {
      fs.writeFileSync(filePath, JSON.stringify(ringroles, null, 2));
      return interaction.reply({ content: `Added ring role: ${role.name} (${role.id})`, ephemeral: true });
    } catch (error) {
      console.error('Error writing ringroles.json:', error);
      return interaction.reply({ content: 'Error saving ring roles.', ephemeral: true });
    }
  },
};
