import { handleReactionConfirmJoinGroup } from "../commands/bot-manager/remote-action-group.js";

//Xử Lý Sự Kiện Reaction
export async function reactionEvents(api, reaction) {
  if (await handleReactionConfirmJoinGroup(api, reaction)) return;
}
