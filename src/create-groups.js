const createGroups = (mondayUsers, popetechUsers) => {
  const usersToAdd = [];
  const usersToUpdate = [];
  const usersToMoveGroup = [];
  const usersToDelete = mondayUsers.filter(
    (mon) => !popetechUsers.find((pope) => pope.name.trim() === mon.name.trim())
  );
  for (let user of popetechUsers) {
    const exists = mondayUsers.find(
      (mon) => mon.name.trim() === user.name.trim()
    );

    if (exists) {
      const groupId = user.lastSeen === "" ? "group_title" : "topics";

      if (groupId !== exists.groupId) {
        usersToMoveGroup.push({ id: exists.id, groupId });
      }

      if (
        user.email.trim() === exists.email.trim() &&
        user.group === exists.group &&
        user.lastSeen === exists.lastSeen &&
        user.role === exists.role &&
        user.sso === (exists.sso === "null" ? null : exists.sso)
      ) {
        continue;
      }
      user["id"] = exists.id;
      usersToUpdate.push(user);
    } else {
      const groupId = user.lastSeen === "" ? "group_title" : "topics";

      user["groupId"] = groupId;
      usersToAdd.push(user);
    }
  }

  return { usersToAdd, usersToMoveGroup, usersToDelete, usersToUpdate };
};

module.exports = { createGroups };
