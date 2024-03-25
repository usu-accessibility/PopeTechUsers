const { monday } = require("./utils");

const getMondayUsers = async () => {
  console.log("Fetching users from Monday.");
  const mondayUsersFull = await monday.api(`
  {
    boards(ids: [4260005974]) {
      items_page(limit: 500) {
        items {
          id
          name
          group {
            id
          }
          column_values {
            id
            text
          }
        }
      }
    }
  }
    `);

  if (mondayUsersFull.errors) {
    console.error(mondayUsersFull.errors);
    throw new Error("Error fetching users.");
  }

  let mondayUsers = [];

  for (let user of mondayUsersFull.data.boards[0].items_page.items) {
    let userToAdd = { id: user.id, name: user.name, groupId: user.group.id };
    for (let value of user.column_values) {
      switch (value.id) {
        case "status":
          userToAdd["role"] = value.text;
          break;
        case "text":
          userToAdd["sso"] = value.text;
          break;
        case "email":
          userToAdd["email"] = value.text;
          break;
        case "text8":
          userToAdd["group"] = value.text;
          break;
        case "date":
          userToAdd["lastSeen"] = value.text;
          break;
        default:
          continue;
      }
    }
    mondayUsers.push(userToAdd);
  }

  console.log("Finished fetching users from Monday.");
  return mondayUsers;
};

module.exports = { getMondayUsers };
