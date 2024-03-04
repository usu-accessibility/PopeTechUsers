require("dotenv").config();
const express = require("express");
const mondaySdk = require("monday-sdk-js");
const axios = require("axios").default;
const throttle = require("promise-ratelimit")(5000);
const dayjs = require("dayjs");

// INIT
const app = express();
const popetech = axios.create({
  headers: { Authorization: `Bearer ${process.env.POPETECH_TOKEN}` },
});
const monday = mondaySdk();
monday.setToken(process.env.MONDAY_TOKEN);

//AXIOS INTERCEPTORS
let limited = false;
popetech.interceptors.request.use(async (config) => {
  if (limited) {
    await throttle();
  }
  return config;
});
popetech.interceptors.response.use((response) => {
  console.log(response.headers["x-ratelimit-remaining"]);
  limited = response.headers["x-ratelimit-remaining"] <= 15;
  return response;
});

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
    const popeTechUsersAll = await popetech.get(
      "https://api.pope.tech/organizations/usu/users?limit=250&include_invited_users=true"
    );
    let popeTechUsers = [];
    for (let user of popeTechUsersAll.data.data) {
      const userSSO = await popetech.get(
        `https://api.pope.tech/organizations/usu/users/${user.public_id}`
      );
      let groups = [];
      for (let group of user.groups) {
        groups.push(group.name);
      }
      popeTechUsers.push({
        name: user.name,
        role: user.role,
        email: user.email,
        lastSeen:
          user.last_seen_at === "Never"
            ? ""
            : dayjs(user.last_seen_at.split(" ")[0]).format("YYYY-MM-DD"),
        sso: userSSO.data.data.shibboleth_unique_identifier,
        groups,
      });
    }
    const mondayUsersFull = await monday.api(`
        query {
            boards(ids:[4260005974]){
            items {
                id
                name
                column_values {
                id
                type
                title
                text
                }
            }
            }
        }
    `);
    let mondayUsers = [];
    for (let user of mondayUsersFull.data.boards[0].items) {
      let userToAdd = { id: user.id, name: user.name };
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
            userToAdd["groups"] = [value.text];
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
    let usersToAdd = [];
    for (let user of popeTechUsers) {
      const exists = mondayUsers.find(
        (element) => element.name.trim() === user.name.trim()
      );
      if (exists) {
        if (
          user.email.trim() === exists.email.trim() &&
          user.groups[0] === exists.groups[0] &&
          user.lastSeen === exists.lastSeen &&
          user.role === exists.role &&
          user.sso === (exists.sso === "null" ? null : exists.sso)
        ) {
          continue;
        }
        user["id"] = exists.id;
        usersToAdd.push(user);
      } else {
        usersToAdd.push(user);
      }
    }
    for (let user of usersToAdd) {
      if (user.id) {
        await monday.api(`
          mutation {
            change_multiple_column_values(item_id: ${
              user.id
            }, board_id: 4260005974, column_values: \"{\\\"status\\\": \\\"${
          user.role
        }\\\", 
              \\\"text\\\": \\\"${
                user.sso
              }\\\", \\\"email\\\": {\\\"email\\\": \\\"${
          user.email
        }\\\", \\\"text\\\": \\\"${user.email}\\\"}, \\\"text8\\\": \\\"${
          user.groups[0]
        }\\\", \\\"date\\\": ${formatDate(user.lastSeen)}}\") {
              id
            }
          }
        `);
      } else {
        const groupId = user.lastSeen === "" ? "group_title" : "topics";
        await monday.api(`
          mutation {
            create_item(board_id: 4260005974, group_id: "${groupId}", item_name: "${
          user.name
        }", column_values: \"{\\\"status\\\": \\\"${user.role}\\\", 
                  \\\"text\\\": \\\"${
                    user.sso
                  }\\\", \\\"email\\\": {\\\"email\\\": \\\"${
          user.email
        }\\\", \\\"text\\\": \\\"${user.email}\\\"}, \\\"text8\\\": \\\"${
          user.groups[0]
        }\\\", \\\"date\\\": ${formatDate(
          user.lastSeen
        )}, \\\"status6\\\": \\\"Updated\\\"}\") {
              id
            }
          }
        `);
      }
    }
    await monday.api(`
    mutation {
      change_simple_column_value(item_id: ${id}, board_id: 4260005974, column_id: "status6", value: "Updated") {
        id
      }
    }
    `);
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

function formatDate(date) {
  if (date === "") {
    return null;
  }
  return `\\\"${date}\\\"`;
}

const port = process.env.PORT || 3015;
app.listen(port, () => console.log(`Server runnning on port ${port}`));
