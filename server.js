require("dotenv").config();
const express = require("express");
const awsServerlessExpressMiddleware = require("aws-serverless-express/middleware");
const mondaySdk = require("monday-sdk-js");
const axios = require("axios").default;
const throttle = require("promise-ratelimit")(5000);

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
// run in production
if (process.env.NODE_ENV !== "development") {
  app.use(awsServerlessExpressMiddleware.eventContext());
  app.use((req, res, next) => {
    req.body = req.apiGateway.event.body;
    next();
  });
}
// always use
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
  try {
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
        lastSeen: user.last_seen_at,
        sso: userSSO.data.data.shibboleth_unique_identifier,
        groups,
      });
    }
    // const mondayUsersFull = await monday.api(`
    //     query {
    //         boards(ids:[4260005974]){
    //         items {
    //             id
    //             name
    //             column_values {
    //             id
    //             type
    //             title
    //             text
    //             }
    //         }
    //         }
    //     }
    // `);
    // let mondayUsers = [];
    // for (let user of mondayUsersFull.data.boards[0].items) {
    //   let userToAdd = { id: user.id, name: user.name };
    //   for (let value of user.column_values) {
    //     switch (value.id) {
    //       case "status":
    //         userToAdd["role"] = value.text;
    //       case "text":
    //         userToAdd["sso"] = value.text;
    //       case "email":
    //         userToAdd["email"] = value.text;
    //       case "text8":
    //         userToAdd["groups"] = [value.text];
    //       case "date":
    //         userToAdd["lastSeen"] = value.text;
    //     }
    //   }
    //   mondayUsers.push(userToAdd);
    // }
    res.json();
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

module.exports = app;
