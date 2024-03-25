const dayjs = require("dayjs");
const { popetech } = require("./utils");

const getPopetechUsers = async () => {
  console.log("Fetching users from Popetech.");
  const popeTechUsersAll = await popetech.get(
    "https://api.pope.tech/organizations/usu/users?limit=250&include_invited_users=true"
  );
  let popeTechUsers = [];
  for (let user of popeTechUsersAll.data.data) {
    const userSSO = await popetech.get(
      `https://api.pope.tech/organizations/usu/users/${user.public_id}`
    );

    popeTechUsers.push({
      name: user.name,
      role: user.role,
      email: user.email,
      lastSeen:
        user.last_seen_at === "Never"
          ? ""
          : dayjs(user.last_seen_at.split(" ")[0]).format("YYYY-MM-DD"),
      sso: userSSO.data.data.shibboleth_unique_identifier,
      group: user.group,
    });
  }

  console.log("Finished fetching users from Popetech.");
  return popeTechUsers;
};

module.exports = { getPopetechUsers };
