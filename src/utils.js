const mondaySdk = require("monday-sdk-js");
const axios = require("axios").default;
const throttle = require("promise-ratelimit")(5000);

const monday = mondaySdk();
monday.setToken(process.env.MONDAY_TOKEN);

const popetech = axios.create({
  headers: { Authorization: `Bearer ${process.env.POPETECH_TOKEN}` },
});

//AXIOS INTERCEPTORS
let limited = false;
popetech.interceptors.request.use(async (config) => {
  if (limited) {
    await throttle();
  }
  return config;
});
popetech.interceptors.response.use((response) => {
  limited = response.headers["x-ratelimit-remaining"] <= 15;
  return response;
});

module.exports = { monday, popetech };
