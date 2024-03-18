require("dotenv").config();
const express = require("express");
const { getPopetechUsers } = require("./src/get-popetech-users");
const { getMondayUsers } = require("./src/get-monday-users");
const { monday } = require("./src/utils");
const { createGroups } = require("./src/create-groups");

// INIT
const app = express();
const PORT = process.env.PORT || 3015;

// MIDDLEWARE
app.use(express.json());
app.use((req, res, next) => {
  if (req.body.hasOwnProperty("challenge")) {
    return res.json(req.body);
  }
  next();
});

// TEST ROUTE
app.get("/", (req, res) => {
  res.json("hello world");
});

// USERS ROUTE
app.post("/users", async (req, res) => {
  const id = req.body.event.pulseId;
  try {
    await monday.api(`
    mutation {
      change_simple_column_value(item_id: ${id}, board_id: 4260005974, column_id: "status6", value: "Working on it") {
        id
      }
    }
    `);

    const popetechUsers = await getPopetechUsers();

    const mondayUsers = await getMondayUsers();

    const { usersToAdd, usersToDelete, usersToMoveGroup, usersToUpdate } =
      createGroups(mondayUsers, popetechUsers);

    // Loop to move users between groups
    for (const user of usersToMoveGroup) {
      const response = await monday.api(`
        mutation {
          move_item_to_group (item_id: ${user.id}, group_id: "${user.groupId}") {
            id
          }
        }
      `);

      if (response.errors) {
        console.error(response);
        throw new Error("Error changing user groups.");
      }
    }

    // Loop to update users from popetech data in monday
    for (const user of usersToUpdate) {
      const values = JSON.stringify(
        JSON.stringify({
          status: user.role,
          text: user.sso,
          email: user.email,
          text8: user.group,
          date: user.lastSeen === "" ? null : user.lastSeen,
        })
      );
      const response = await monday.api(`
        mutation {
          change_multiple_column_values(item_id: ${user.id}, board_id: 4260005974, column_values: ${values}) {
            id
          }
        }
      `);

      if (response.errors) {
        console.error(response);
        throw new Error("Error updating a user");
      }
    }

    // Loop to add users from popetech to monday
    for (const user of usersToAdd) {
      const values = JSON.stringify(
        JSON.stringify({
          status: user.role,
          text: user.sso,
          email: user.email,
          text8: user.group,
          date: user.lastSeen === "" ? null : user.lastSeen,
          status6: "Updated",
        })
      );
      const response = await monday.api(`
          mutation {
              create_item(board_id: 4260005974, group_id: "${user.groupId}", item_name: "${user.name}", column_values:${values}) {
                id
              }
          }
      `);

      if (response.errors) {
        console.error(response);
        throw new Error("Error adding a user");
      }
    }

    // Loop to delete users in monday
    for (const user of usersToDelete) {
      const response = await monday.api(`
        mutation {
          delete_item (item_id: ${user.id}) {
            id
          }
        }
      `);

      if (response.errors) {
        console.error(response);
        throw new Error("Error deleting a user");
      }
    }

    res.sendStatus(200);
  } catch (error) {
    await monday.api(`
    mutation {
      change_simple_column_value(item_id: ${id}, board_id: 4260005974, column_id: "status6", value: "Stuck") {
        id
      }
    }
    `);
    console.error(error);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => console.log(`Server runnning on port ${PORT}`));
