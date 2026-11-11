window.__ModuleLoader__.load({
  id: "@czwjss/feishu-bot-im",
  factory(require) {
    const module = { exports: {} };
    (function (module, exports, require) {
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client/index.js
var index_exports = {};
__export(index_exports, {
  createPlugin: () => createPlugin
});
module.exports = __toCommonJS(index_exports);
var import_react5 = __toESM(require("react"), 1);

// client/shared.js
var import_react = __toESM(require("react"), 1);

// client/locale.js
var NS = "imFeishu";
var MESSAGES = Object.freeze({
  "\u8FD9\u91CC\u51FA\u9519\u4E86": "Something broke",
  "\u8BF7\u6C42\u5931\u8D25": "Request failed",
  "\u8FD0\u884C\u6B63\u5E38": "Connected",
  "\u6B63\u5728\u8FDE\u63A5": "Connecting",
  "\u6B63\u5728\u91CD\u8FDE": "Reconnecting",
  "\u8FDE\u63A5\u5F02\u5E38": "Error",
  "\u672A\u8FDE\u63A5": "Idle",
  "\u626B\u7801\u8865\u9F50\u6743\u9650": "Grant by scanning",
  "\u626B\u7801\u6DFB\u52A0\u673A\u5668\u4EBA": "Add by scanning",
  "\u624B\u52A8\u6DFB\u52A0\u673A\u5668\u4EBA": "Add manually",
  "\u6B63\u5728\u751F\u6210\u4E8C\u7EF4\u7801\u2026": "Preparing QR\u2026",
  "\u7B49\u5F85\u626B\u7801\u786E\u8BA4": "Waiting for scan",
  "\u8BF7\u5728\u98DE\u4E66\u91CC\u786E\u8BA4": "Confirm in Feishu",
  "\u5DF2\u5728\u98DE\u4E66\u91CC\u53D6\u6D88": "Cancelled in Feishu",
  "\u5DF2\u8FC7\u671F": "Expired",
  "\u5DF2\u751F\u6548": "Applied",
  "\u8BF7\u7A0D\u5019\u2026": "Please wait\u2026",
  "\u53D6\u6D88\u626B\u7801": "Stop",
  "\u91CD\u65B0\u751F\u6210": "Retry",
  "\u98DE\u4E66\u5F00\u653E\u5E73\u53F0 \u2192 \u81EA\u5EFA\u5E94\u7528 \u2192 \u51ED\u8BC1\u4E0E\u57FA\u7840\u4FE1\u606F\uFF0C\u590D\u5236 App ID \u4E0E App Secret\u3002": "Feishu console \u2192 custom app \u2192 credentials.",
  "\u53EA\u63D0\u4EA4\u7ED9\u672C\u673A Host\uFF0C\u5199\u5165 DSH \u51ED\u636E\u5E93\uFF0C\u4E0D\u4F1A\u56DE\u4F20\u6D4F\u89C8\u5668\u3002": "Stored by the local Host credential service; never returned.",
  "\u53D6\u6D88": "Cancel",
  "\u6B63\u5728\u9A8C\u8BC1\u2026": "Verifying\u2026",
  "\u7ED1\u5B9A\u5E76\u8FDE\u63A5": "Bind and connect",
  "\u5916\u89C2\u4E0E\u540D\u79F0": "Appearance",
  "\u53EA\u5728\u672C\u63D2\u4EF6\u91CC\u5C55\u793A\uFF0C\u4E0D\u5F71\u54CD\u98DE\u4E66\u4E2D\u7684\u673A\u5668\u4EBA\u540D\u79F0\uFF1B\u7559\u7A7A\u6062\u590D\u5E94\u7528\u539F\u540D\u3002": "Shown only in this plugin; empty restores the app name.",
  "\u6807\u8BC6\u8272": "Accent color",
  "\u4FDD\u5B58\u4E2D\u2026": "Saving\u2026",
  "\u4FDD\u5B58": "Save",
  "\u72B6\u6001": "State",
  "\u5E94\u7528 ID": "App ID",
  "\u673A\u5668\u4EBA": "Bot",
  "\u673A\u5668\u4EBA Open ID": "Bot Open ID",
  "\u7ED1\u5B9A\u4F1A\u8BDD": "Bound chats",
  "\u5DE5\u4F5C\u533A": "Workspace",
  "\u9ED8\u8BA4\u6A21\u578B": "Model",
  "Agent \u9884\u8BBE": "Agent preset",
  "\u8FDE\u63A5\u65F6\u95F4": "Connected at",
  "\u6700\u8FD1\u9519\u8BEF": "Last error",
  "\u8FDE\u63A5\u8BE6\u60C5": "Connection details",
  "\u7F3A\u5C11\u6743\u9650\u65F6\uFF0C\u626B\u7801\u4E00\u6B21\u5373\u53EF\u8865\u9F50": "Scan once to grant the required permissions",
  "\u8865\u9F50\u6743\u9650": "Grant permissions",
  "\u5DF2\u590D\u5236": "Copied",
  "\u590D\u5236": "Copy",
  "\u5173\u95ED": "Close",
  "\u5DF2\u4FDD\u5B58": "Saved",
  "\u98DE\u4E66\u673A\u5668\u4EBA": "Feishu bots",
  "\u6CE8\u5165\u54EA\u4E9B\u6765\u6E90\u5B57\u6BB5\uFF1A\u53EA\u52FE\u9009\u6A21\u578B\u65E0\u6CD5\u81EA\u884C\u63A8\u65AD\u7684\u6D88\u606F\u5143\u4FE1\u606F\u3002": "Which source fields to inject.",
  "\u589E\u5F3A\u63D0\u793A\u8BCD\uFF08\u53EF\u9009\uFF09": "Guidance (optional)",
  "\u4FEE\u6539\u663E\u793A\u540D\u79F0": "Rename",
  "\u4F1A\u8BDD": "chats",
  "\u6D4B\u8BD5": "Test",
  "\u91CD\u8FDE": "Reconnect",
  "\u8BE6\u60C5": "Details",
  "\u901A\u7528": "General",
  "\u9ED8\u8BA4\u5DE5\u4F5C\u533A": "Default workspace",
  "\u5217\u8868\u6765\u81EA DSH \u5DF2\u767B\u8BB0\u7684\u5DE5\u4F5C\u533A\u3002": "From the workspaces DSH already knows.",
  "\u8DDF\u968F DSH \u9ED8\u8BA4": "Host default",
  "\u81EA\u5B9A\u4E49\u8DEF\u5F84\u2026": "Custom path\u2026",
  "\u9ED8\u8BA4\u6A21\u578B\uFF08\u53EA\u5F71\u54CD\u65B0\u4F1A\u8BDD\uFF09": "Default model (new Sessions)",
  "\u8DDF\u968F Host \u9ED8\u8BA4": "Host default",
  "\u601D\u8003\u5F3A\u5EA6": "Reasoning effort",
  "\u8DDF\u968F\u6A21\u578B\u9ED8\u8BA4": "Model default",
  "\u8FC7\u7A0B\u8BE6\u7EC6\u5EA6": "Progress detail",
  "\u8BE6\u7EC6\uFF1A\u663E\u793A\u6BCF\u4E2A\u5DE5\u5177\u7684\u540D\u79F0\u4E0E\u53C2\u6570\uFF1B\u7B80\u8981\uFF1A\u53EA\u663E\u793A\u5DE5\u5177\u540D\u4E0E\u6C47\u603B\u3002": "Detailed shows tool arguments; brief keeps names and the summary.",
  "\u8BE6\u7EC6": "Detailed",
  "\u7B80\u8981": "Brief",
  "\u65B0\u4F1A\u8BDD\u6743\u9650\u6863\u4F4D": "New-session permission",
  "\u53EA\u5F71\u54CD\u4E4B\u540E\u65B0\u5EFA\u7684\u4F1A\u8BDD\uFF0C\u5DF2\u6709\u4F1A\u8BDD\u4E0D\u53D8\u3002": "Applies only to Sessions created later.",
  "\uFF08\u5F53\u524D\uFF09": " (current)",
  "\u9ED8\u8BA4 Agent \u9884\u8BBE\uFF08\u53EA\u5F71\u54CD\u65B0\u4F1A\u8BDD\uFF09": "Default agent preset (new Sessions)",
  "\u8DDF\u968F Host \u9ED8\u8BA4\u9884\u8BBE": "Host default preset",
  "\u79C1\u804A": "Private chat",
  "\u8FD0\u884C\u4E2D\u6536\u5230\u666E\u901A\u6D88\u606F": "While a turn runs",
  "\u6392\u961F\u7B49\u5F85": "Queue",
  "\u63D2\u5165\u4E3A\u8865\u5145\u6307\u4EE4": "Steer",
  "\u79C1\u804A\u4E0A\u4E0B\u6587\u6CE8\u5165": "Private-chat context",
  "\u7FA4\u804A": "Group chat",
  "\u542F\u7528\u8BDD\u9898": "Enable topics",
  "\u5F00\u542F\u540E\u6240\u6709\u7FA4\u6210\u5458\u90FD\u80FD\u7528 /topic \u5F00\u8BDD\u9898\u3001/topic-sync \u540C\u6B65\u7ED3\u8BBA\uFF0C\u4E0D\u53D7\u7BA1\u7406\u767D\u540D\u5355\u9650\u5236\u3002": "Anyone in the group may open or sync topics; the manager list does not apply.",
  "\u5141\u8BB8": "Allow",
  "\u54CD\u5E94\u5176\u5B83\u673A\u5668\u4EBA\u7684\u6D88\u606F": "Reply to other bots",
  "\u5F00\u542F\u540E\uFF0C\u5176\u5B83\u673A\u5668\u4EBA\uFF08\u5E94\u7528\uFF09\u5728\u7FA4\u91CC\u7684\u53D1\u8A00\u4E5F\u4F1A\u89E6\u53D1\u672C\u673A\u5668\u4EBA\u3002": "When on, messages from other bots also trigger this bot.",
  "\u65C1\u542C\u7FA4\u6D88\u606F\uFF08\u9ED8\u8BA4\u5F00\u542F\uFF09": "Eavesdrop group messages (on by default)",
  "\u53EA\u628A\u6CA1\u6709 at \u4F60\u7684\u6D88\u606F\u8BB0\u4E3A\u4E0A\u4E0B\u6587\uFF0C\u4E0D\u4F1A\u89E6\u53D1\u56DE\u590D\uFF1B\u56FE\u7247/\u6587\u4EF6\u53EA\u8BB0\u5360\u4F4D\u4FE1\u606F\uFF0C\u6A21\u578B\u9700\u8981\u65F6\u4F1A\u8BF7\u4F60 at \u5B83\u91CD\u53D1\u3002\u9700\u8981 im:message.group_msg \u6743\u9650\uFF1B\u53EF\u7528\u300C\u8865\u9F50\u6743\u9650\u300D\u626B\u7801\u6388\u6743\u3002": 'Only messages that do not mention the bot are kept as context; never triggers a reply; images/files become placeholders and the model asks you to mention it and resend them when needed. Requires im:message.group_msg; use "Grant permissions" to authorize.',
  "\u6EDA\u52A8\u4FDD\u7559\u6761\u6570": "Rolling buffer size",
  "\u9ED8\u8BA4\u4FDD\u7559\u6700\u8FD1 20 \u6761\uFF1B\u8D85\u8FC7\u540E\u4E22\u5F03\u6700\u65E7\u7684\u65C1\u542C\u6D88\u606F\uFF0C\u6700\u591A 500 \u6761\u3002": "Keeps the latest 20 messages by default; older messages are dropped past this limit, up to 500.",
  "\u5141\u8BB8\u673A\u5668\u4EBA at \u4EBA\uFF08\u9ED8\u8BA4\u5F00\u542F\uFF09": "Let the bot mention people (on by default)",
  "\u6D89\u53CA\u9700\u8981\u67D0\u4EBA\u51B3\u7B56\u3001\u6279\u51C6\u3001\u786E\u8BA4\u6216\u9009\u62E9\u65F6\uFF0C\u4E00\u5F8B\u7528 at \u63D0\u53CA\u5F53\u4E8B\u4EBA\uFF1B\u7EAF\u4FE1\u606F\u540C\u6B65\u3001\u72B6\u6001\u6C47\u62A5\u548C\u95F2\u804A\u4E0D\u8981 at\uFF1B\u4E0D\u786E\u5B9A\u5177\u4F53\u5F53\u4E8B\u4EBA\u65F6\u4E5F\u4E0D\u8981 at\u3002\u63D2\u4EF6\u4F1A\u6821\u9A8C open_id\uFF0C\u975E\u6CD5\u6216\u672A\u5F00\u542F\u65F6\u64E6\u9664\u3002": "When someone must decide, approve, confirm, or choose, always mention that person; do not mention for plain information sync, status updates, or chat, and do not guess when the person is unclear. The plugin validates open_ids and erases invalid or disabled mentions.",
  "\u7981\u6B62 @\u6240\u6709\u4EBA\uFF08\u9ED8\u8BA4\u5F00\u542F\uFF09": "Forbid @all (on by default)",
  "\u5173\u95ED\u540E\u6A21\u578B\u53EF\u4EE5 @\u6240\u6709\u4EBA\uFF1B\u63D2\u4EF6\u4ECD\u4F1A\u6821\u9A8C open_id\u3002": "When off, the model may mention everyone; open_ids are still validated.",
  "\u7981\u6B62": "Forbid",
  "\u8C01\u80FD\u4F7F\u7528\u7FA4\u804A\u4E2D\u7684\u673A\u5668\u4EBA": "Who may use the bot in groups",
  "\u6240\u6709\u7528\u6237": "Everyone",
  "\u4EC5\u767D\u540D\u5355": "Allowlist",
  "\u7FA4\u804A\u767D\u540D\u5355 Open ID": "Group allowlist Open IDs",
  "\u7BA1\u7406\u767D\u540D\u5355 Open ID\uFF08\u53EF\u6267\u884C /new\u3001\u505C\u6B62\u3001\u8C03\u6574\u4E0E\u5BA1\u6279\uFF09": "Manager allowlist (may run /new, stop, adjust and approve)",
  "\u7559\u7A7A\u8868\u793A\u6CA1\u6709\u4EBA\u53EF\u4EE5\u5728\u7FA4\u91CC\u6267\u884C\u7BA1\u7406\u64CD\u4F5C\u3002": "Empty means nobody may manage in groups.",
  "\u7FA4\u804A\u4E0A\u4E0B\u6587\u6CE8\u5165": "Group-chat context",
  "\u79FB\u9664": "Remove",
  "\u79FB\u9664\u6B64\u673A\u5668\u4EBA": "Remove this bot",
  "\u8BFB\u53D6\u5931\u8D25\uFF1A": "Failed: ",
  "\u91CD\u8BD5": "Retry",
  "\u6B63\u5728\u8BFB\u53D6\u2026": "Loading\u2026",
  "\u624B\u52A8\u6DFB\u52A0": "Add manually",
  "\u626B\u7801\u6DFB\u52A0": "Add by scanning",
  "\u8FD8\u6CA1\u6709\u673A\u5668\u4EBA\u3002\u70B9\u51FB\u53F3\u4E0A\u89D2\u300C\u6DFB\u52A0\u673A\u5668\u4EBA\u300D\uFF0C\u586B\u5165\u98DE\u4E66\u5E94\u7528\u7684 App ID / App Secret\u3002": "No bots yet. Use \u201CAdd bot\u201D and paste the app credentials.",
  "\u6CA1\u6709\u62FF\u5230\u98DE\u4E66\u6388\u6743\u94FE\u63A5": "No authorization URL returned",
  "\u5DF2\u65AD\u5F00\u6388\u6743": "Disconnected",
  "token \u5DF2\u5237\u65B0": "Token refreshed",
  "\u626B\u7801\u540E\u5728\u98DE\u4E66\u786E\u8BA4\u3002": "Confirm in Feishu after scanning.",
  "\u672A\u547D\u540D\u7528\u6237": "Unnamed user",
  "\u5DF2\u8FDE\u63A5": "Connected",
  "access_token \u5230\u671F": "access_token expires",
  "refresh_token \u5230\u671F": "refresh_token expires",
  "\u5F53\u524D\u6388\u6743\u7F3A\u5C11\u6743\u9650\uFF0C\u8BF7\u91CD\u65B0\u6388\u6743\uFF1A": "Authorization is missing scopes; re-authorize: ",
  "\u91CD\u65B0\u6388\u6743": "Re-authorize",
  "\u5237\u65B0\u4E2D\u2026": "Refreshing\u2026",
  "\u5237\u65B0 token": "Refresh token",
  "\u786E\u8BA4\u65AD\u5F00\uFF1F": "Confirm disconnect?",
  "\u65AD\u5F00\u6388\u6743": "Disconnect",
  "\u6B63\u5728\u53D1\u8D77\u2026": "Starting\u2026",
  "\u8FDE\u63A5\u98DE\u4E66": "Connect Feishu",
  "\u5237\u65B0\u72B6\u6001": "Refresh",
  "\u98DE\u4E66\u5206\u8EAB": "Feishu identity",
  "\u53D6\u6D88\u6388\u6743": "Cancel authorization",
  "\u5206\u8EAB": "Identity",
  "\u53D1\u9001\u8005 Open ID": "Sender Open ID",
  "\u53D1\u9001\u8005\u540D\u79F0": "Sender name",
  "\u53D1\u9001\u65F6\u95F4": "Sent at",
  "\u7FA4\u540D\u79F0": "Group name",
  "\u84DD\u8272": "Blue",
  "\u7EA2\u8272": "Red",
  "\u7EFF\u8272": "Green",
  "\u7D2B\u8272": "Purple",
  "\u6A59\u8272": "Orange",
  "\u6D88\u606F\u76D1\u542C": "Message monitoring",
  "\u505C\u6B62\u76D1\u542C": "Stop",
  "\u5F00\u59CB\u76D1\u542C": "Start",
  "\u5B9A\u65F6\u68C0\u67E5\u5DF2\u9009\u4F1A\u8BDD\u7684\u65B0\u6D88\u606F\uFF0C\u8BB0\u5F55\u5230\u672C\u5730\u6536\u4EF6\u7BB1\u3002\u65B0\u589E\u76D1\u542C\u4ECE\u5F53\u524D\u65F6\u95F4\u5F00\u59CB\uFF0C\u4E0D\u56DE\u8865\u5386\u53F2\uFF1B\u4E0D\u8C03\u7528\u6A21\u578B\uFF0C\u4E5F\u4E0D\u81EA\u52A8\u56DE\u590D\u3002": "Polls selected chats and delivers new messages to DSH. New monitors start at the current time and do not backfill history.",
  "\u6B63\u5728\u8BFB\u53D6\u76D1\u542C\u72B6\u6001\u2026": "Loading monitor status\u2026",
  "\u76D1\u542C\u4E2D": "Watching",
  "\u5DF2\u6682\u505C": "Paused",
  "\u6700\u540E\u68C0\u67E5": "Last check",
  "\u7ACB\u5373\u68C0\u67E5": "Check now",
  "\u8FD8\u6CA1\u6709\u76D1\u542C\u4F1A\u8BDD\u3002\u70B9\u201C\u9009\u62E9\u4F1A\u8BDD\u201D\u6DFB\u52A0\u3002": "No monitored chats yet. Choose chats to add.",
  "\u6CA1\u6709\u53EF\u6DFB\u52A0\u7684\u4F1A\u8BDD\u3002": "No chats available to add.",
  "\u9009\u62E9\u4F1A\u8BDD": "Choose chats",
  "\u6DFB\u52A0": "Add",
  "\u624B\u52A8\u586B chat_id\uFF08oc_\u2026\uFF09": "Enter chat_id (oc_\u2026)",
  "\u4F1A\u8BDD\u5217\u8868\u5DF2\u540C\u65F6\u5305\u542B\u7FA4\u804A\u548C\u6700\u8FD1\u79C1\u804A\uFF1B\u627E\u4E0D\u5230\u65F6\u53EF\u624B\u52A8\u586B chat_id\u3002": "The picker includes groups and recent direct chats; enter a chat_id manually if one is missing.",
  "\u6761\u672A\u8BFB": "unread",
  "\u5168\u90E8\u5DF2\u8BFB": "Mark read",
  "\u6E05\u7A7A\u8BB0\u5F55": "Clear",
  "\u672A\u77E5": "Unknown",
  "\u5168\u90E8\u6D88\u606F": "All messages",
  "\u4EC5@\u6211/\u56DE\u590D\u6211": "Mentions & replies",
  "\u5173\u952E\u8BCD": "Keywords",
  "\u5173\u952E\u8BCD\uFF0C\u7528\u9017\u53F7\u5206\u9694": "Keywords, comma separated",
  "\u6761\u5F85\u786E\u8BA4\u8349\u7A3F": "drafts to confirm",
  "\u56DE\u590D\u6D88\u606F": "reply",
  "\u53D1\u9001": "Send",
  "\u5FFD\u7565": "Ignore",
  "\u5904\u7406\u65B9\u5F0F": "Handling",
  "\u53EA\u8BB0\u5F55": "Record only",
  "\u751F\u6210\u8349\u7A3F": "Draft",
  "\u81EA\u52A8\u56DE\u590D": "Auto reply",
  "\u81EA\u52A8\u56DE\u590D\uFF08\u542B\u673A\u5668\u4EBA\uFF09": "Auto reply (bots too)",
  "\u5F85\u5904\u7406": "pending",
  "\u4E0A\u6B21\u81EA\u52A8\u56DE\u590D": "last auto"
});
function dictionaries() {
  const zh = {};
  const en = {};
  for (const [key, value] of Object.entries(MESSAGES)) {
    zh[key] = key;
    en[key] = value;
  }
  return { zh, en };
}

// client/shared.js
var h = import_react.default.createElement;
var RPC_ENDPOINT = "im-feishu";
var API = {
  botAccessSet: "bot.access.set",
  botAdd: "bot.add",
  botAliasSet: "bot.alias.set",
  botBusyModeSet: "bot.busy-mode.set",
  botColorSet: "bot.color.set",
  botContextSet: "bot.context-enhancement.set",
  botEavesdropSet: "bot.eavesdrop.set",
  botMentionsSet: "bot.mentions.set",
  botBotReplySet: "bot.bot-reply.set",
  botTopicsSet: "bot.topics.set",
  botProcessDetailSet: "bot.process-detail.set",
  botModelSet: "bot.model.set",
  botPresetSet: "bot.preset.set",
  botPermissionSet: "bot.permission.set",
  botReconnect: "bot.reconnect",
  botRemove: "bot.remove",
  botTest: "bot.test",
  botWorkspaceSet: "bot.workspace.set",
  botsList: "bots.list",
  modelsList: "models.list",
  presetsList: "presets.list",
  provisionBegin: "provision.begin",
  provisionCancel: "provision.cancel",
  provisionPoll: "provision.poll",
  workspacesList: "workspaces.list",
  permissionList: "permission.list",
  userStatus: "user.status",
  userConnectBegin: "user.connect.begin",
  userConnectCancel: "user.connect.cancel",
  userDisconnect: "user.disconnect",
  userRefresh: "user.refresh",
  userMonitorStatus: "user.monitor.status",
  userMonitorChats: "user.monitor.chats",
  userMonitorAdd: "user.monitor.add",
  userMonitorRemove: "user.monitor.remove",
  userMonitorEnable: "user.monitor.enable",
  userMonitorPoll: "user.monitor.poll",
  userMonitorChatSet: "user.monitor.chat.set",
  userMonitorDraftSend: "user.monitor.draft.send",
  userMonitorDraftIgnore: "user.monitor.draft.ignore",
  userMonitorInbox: "user.monitor.inbox",
  userMonitorRead: "user.monitor.read",
  userMonitorClear: "user.monitor.clear"
};
var boundTranslate = null;
var activeLocale = "";
function configureLocale(service) {
  boundTranslate = service.bind(NS);
  activeLocale = service.getLocale().active;
  return service.subscribe(() => {
    activeLocale = service.getLocale().active;
  });
}
function t(zh, en) {
  const translated = boundTranslate?.(zh);
  if (translated && translated !== zh) return translated;
  const language = activeLocale || (navigator.language || "");
  return language.toLowerCase().startsWith("zh") ? zh : en;
}
var text = (pair) => Array.isArray(pair) ? t(pair[0], pair[1]) : String(pair);
var CE_FIELDS = ["senderId", "senderName", "botId", "sentAt", "conversationTitle"];
var CE_LABELS = {
  senderId: ["\u53D1\u9001\u8005 Open ID", "Sender Open ID"],
  senderName: ["\u53D1\u9001\u8005\u540D\u79F0", "Sender name"],
  botId: ["\u673A\u5668\u4EBA Open ID", "Bot Open ID"],
  sentAt: ["\u53D1\u9001\u65F6\u95F4", "Sent at"],
  conversationTitle: ["\u7FA4\u540D\u79F0", "Group name"]
};
var BOT_COLORS = {
  blue: { main: "#3370ff", soft: "rgba(51,112,255,.10)", ring: "rgba(51,112,255,.32)", edge: "#93b4ff" },
  red: { main: "#e5484d", soft: "rgba(229,72,77,.10)", ring: "rgba(229,72,77,.30)", edge: "#f0a9ab" },
  green: { main: "#00b96b", soft: "rgba(0,185,107,.10)", ring: "rgba(0,185,107,.28)", edge: "#7fd9b4" },
  purple: { main: "#7c4dff", soft: "rgba(124,77,255,.10)", ring: "rgba(124,77,255,.30)", edge: "#bda6ff" },
  orange: { main: "#ff8800", soft: "rgba(255,136,0,.12)", ring: "rgba(255,136,0,.30)", edge: "#ffc183" }
};
var COLOR_NAMES = {
  blue: ["\u84DD\u8272", "Blue"],
  red: ["\u7EA2\u8272", "Red"],
  green: ["\u7EFF\u8272", "Green"],
  purple: ["\u7D2B\u8272", "Purple"],
  orange: ["\u6A59\u8272", "Orange"]
};
var emptyScope = () => ({ enabled: true, fields: ["senderId", "senderName", "botId", "sentAt"], guidance: "" });
var emptyEnhancement = () => ({ group: emptyScope(), direct: emptyScope() });
var CSS = `
.bxf-page { --bxf-radius: 12px; }
.bxf-page select {
  appearance: none; -webkit-appearance: none; cursor: pointer;
  padding-right: 30px !important;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") !important;
  background-repeat: no-repeat !important;
  background-position: right 10px center !important;
}
.bxf-page input, .bxf-page select { height: 34px; }
.bxf-page input:focus, .bxf-page select:focus, .bxf-page textarea:focus {
  outline: 2px solid var(--bxf-accent-ring, rgba(51,112,255,.32));
  outline-offset: 1px;
  border-color: var(--bxf-accent-edge, #93b4ff);
}
.bxf-page select option:checked {
  background: var(--dsw-alias-button-primary-fill, var(--dsw-alias-label-primary, #3370ff)) !important;
  color: var(--dsw-alias-label-primary-foreground, var(--dsw-alias-bg-base, #fff)) !important;
}
.bxf-card { transition: box-shadow .16s ease, border-color .16s ease; background: var(--dsw-alias-bg-layer-1, #fff); }
.bxf-card > .bxf-head { background: var(--dsw-alias-bg-layer-1, #fff); }
.bxf-card:hover { box-shadow: 0 8px 22px rgba(15,23,42,.07); border-color: var(--dsw-alias-border-l2); }
.bxf-head { border-radius: 0; }
.bxf-panel-head:hover .bxf-panel-title { color: var(--bxf-accent, #3370ff); }
.bxf-btn:hover { filter: brightness(.97); }
.bxf-icon-btn:hover { background: rgba(148,163,184,.18); color: var(--bxf-accent, var(--dsw-alias-brand-primary)); }
.bxf-mini { background: transparent !important; -webkit-appearance: none; appearance: none;
  font-size: 11px; padding: 3px 8px; border-radius: 7px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l1, #e2e8f0); background: transparent; color: var(--dsw-alias-label-secondary); }
.bxf-mini:hover { color: var(--bxf-accent, #3370ff); border-color: var(--bxf-accent-edge, #93b4ff); background: var(--bxf-accent-soft, rgba(51,112,255,.10)) !important; }
.bxf-check { background: transparent !important; -webkit-appearance: none; appearance: none;
  width: 27px; height: 27px; border-radius: 8px; cursor: pointer; flex: none;
  border: 1px solid var(--dsw-alias-border-l1, #d1d5db); background: transparent;
  color: var(--bxf-accent, #3370ff); font-size: 13px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; }
.bxf-check:hover, .bxf-check:focus { background: var(--bxf-accent-soft, rgba(51,112,255,.10)) !important; border-color: var(--bxf-accent-edge, #93b4ff); }
.bxf-check:active { background: var(--bxf-accent-soft, rgba(51,112,255,.10)) !important; }
.bxf-danger:hover { background: rgba(185,28,28,.07); border-color: rgba(185,28,28,.55); }
.bxf-check:disabled { opacity: .45; cursor: default; }
.bxf-fieldrow { display: flex; align-items: flex-end; gap: 8px; }
.bxf-fieldgrow { flex: 1; min-width: 0; }
.bxf-btn:active { transform: translateY(1px); }
.bxf-tip { position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 15px; height: 15px; margin-left: 6px; border-radius: 50%;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: 10px; font-weight: 700;
  cursor: help; user-select: none; flex: none; }
.bxf-tip-body { position: absolute; left: 0; top: 21px; min-width: 180px; max-width: 300px;
  padding: 8px 10px; border-radius: 8px; background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary); border: 1px solid var(--dsw-alias-border-l1);
  font-size: 11px; font-weight: 400; line-height: 1.55; white-space: normal;
  box-shadow: 0 10px 26px rgba(15,23,42,.22); opacity: 0; visibility: hidden;
  transition: opacity .12s ease; z-index: 30; pointer-events: none; }
.bxf-tip:hover .bxf-tip-body, .bxf-tip:focus .bxf-tip-body, .bxf-tip:focus-within .bxf-tip-body {
  opacity: 1; visibility: visible; }
.bxf-labelrow { display: flex; align-items: center; gap: 2px; margin-bottom: 5px; }
`;
var S = {
  page: { padding: "18px 22px", maxWidth: "980px", color: "var(--dsw-alias-label-primary, #1c1c1e)" },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "14px" },
  title: { margin: 0, fontSize: "18px", fontWeight: 600 },
  sub: { margin: "2px 0 0", fontSize: "12px", color: "var(--dsw-alias-label-secondary, #6b7280)" },
  labelrow: { display: "flex", alignItems: "center", marginBottom: "5px" },
  card: {
    border: "1px solid var(--dsw-alias-border-l1, #e5e7eb)",
    borderRadius: "12px",
    background: "var(--dsw-alias-bg-layer-1, #fff)",
    marginBottom: "12px",
    overflow: "hidden",
    boxShadow: "0 1px 2px rgba(15,23,42,.04)"
  },
  cardHead: { display: "flex", alignItems: "center", gap: "10px", padding: "13px 16px", cursor: "pointer" },
  grow: { flex: 1, minWidth: 0 },
  name: { fontSize: "14px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  nameRow: { display: "flex", alignItems: "center", gap: "4px" },
  idRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginTop: "2px" },
  iconBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "2px 4px",
    borderRadius: "6px",
    fontSize: "12px",
    lineHeight: 1,
    color: "var(--dsw-alias-label-secondary)",
    transition: "background .15s ease, color .15s ease"
  },
  meta: { fontSize: "12px", color: "var(--dsw-alias-label-secondary, #6b7280)", marginTop: "2px" },
  badge: (tone) => ({
    display: "inline-block",
    padding: "1px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    background: tone === "ok" ? "rgba(16,185,129,.12)" : tone === "warn" ? "rgba(245,158,11,.16)" : "rgba(148,163,184,.18)",
    color: tone === "ok" ? "var(--dsw-alias-state-success-primary)" : tone === "warn" ? "var(--dsw-alias-state-warn-primary)" : "var(--dsw-alias-state-idle-primary)"
  }),
  body: { borderTop: "1px solid var(--dsw-alias-border-l1, #e5e7eb)", padding: "4px 14px 14px" },
  panel: { borderTop: "1px solid var(--dsw-alias-border-l1, #f1f5f9)", padding: "10px 0" },
  panelHead: { display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 600, padding: "2px 0" },
  panelBody: { marginTop: "8px", display: "grid", gap: "10px" },
  label: { display: "block", fontSize: "12px", fontWeight: 500, marginBottom: "4px", color: "var(--dsw-alias-label-secondary, #4b5563)" },
  hint: { fontSize: "11px", color: "var(--dsw-alias-label-secondary, #6b7280)", marginTop: "3px", lineHeight: 1.5 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    height: "34px",
    padding: "0 10px",
    fontSize: "13px",
    borderRadius: "8px",
    border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
    background: "var(--dsw-alias-bg-layer-2, #fff)",
    color: "var(--dsw-alias-label-primary)"
  },
  area: { width: "100%", boxSizing: "border-box", minHeight: "62px", padding: "7px 9px", fontSize: "12px", borderRadius: "8px", border: "1px solid var(--dsw-alias-border-l2, #d1d5db)", background: "var(--dsw-alias-bg-layer-2, #fff)", color: "var(--dsw-alias-label-primary)" },
  row: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" },
  btn: (kind) => ({
    padding: "6px 12px",
    fontSize: "12px",
    borderRadius: "8px",
    cursor: "pointer",
    border: kind === "primary" ? "1px solid transparent" : "1px solid var(--dsw-alias-border-l1, #d1d5db)",
    background: kind === "primary" ? "var(--dsw-alias-button-primary-fill, var(--dsw-alias-label-primary, #3370ff))" : "transparent",
    color: kind === "primary" ? "var(--dsw-alias-label-primary-foreground, var(--dsw-alias-bg-base, #fff))" : "inherit"
  }),
  dangerBtn: {
    padding: "5px 12px",
    fontSize: "12px",
    borderRadius: "8px",
    cursor: "pointer",
    border: "1px solid var(--dsw-alias-state-error-primary)",
    background: "transparent",
    color: "var(--dsw-alias-state-error-primary)"
  },
  error: { fontSize: "12px", color: "var(--dsw-alias-state-error-primary)" },
  toast: {
    position: "fixed",
    top: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "var(--dsw-alias-bg-overlay)",
    color: "var(--dsw-alias-label-primary)",
    fontSize: "13px",
    border: "1px solid var(--dsw-alias-border-l1)",
    padding: "8px 18px",
    borderRadius: "8px",
    zIndex: 9999,
    boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
    pointerEvents: "none"
  },
  check: {
    width: "27px",
    height: "27px",
    borderRadius: "8px",
    cursor: "pointer",
    flex: "none",
    border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
    background: "transparent",
    color: "var(--bxf-accent, #3370ff)",
    fontSize: "13px",
    lineHeight: 1
  },
  checkRow: { display: "flex", flexWrap: "wrap", gap: "6px 14px" },
  checkLabel: { fontSize: "12px", display: "flex", gap: "5px", alignItems: "center" },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
    padding: "20px"
  },
  modal: {
    width: "min(460px, 100%)",
    background: "var(--dsw-alias-bg-layer-1, #fff)",
    color: "var(--dsw-alias-label-primary)",
    borderRadius: "14px",
    padding: "18px",
    boxShadow: "0 24px 60px rgba(15,23,42,.24)",
    border: "1px solid var(--dsw-alias-border-l1, #e5e7eb)"
  }
};
var Boundary = class extends import_react.default.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, stack: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[im-feishu] render failed", error, info?.componentStack);
    this.setState({ stack: info?.componentStack ?? null });
  }
  render() {
    const { error, stack } = this.state;
    if (!error) return this.props.children;
    return h(
      "div",
      { style: { padding: "16px", color: "var(--dsw-alias-state-error-primary)", fontSize: "12px" } },
      h("div", { style: { fontWeight: 600, marginBottom: "6px" } }, t("\u8FD9\u91CC\u51FA\u9519\u4E86", "Something broke")),
      h("pre", { style: { whiteSpace: "pre-wrap", margin: 0 } }, String(error?.message ?? error)),
      stack ? h("pre", { style: { whiteSpace: "pre-wrap", marginTop: "8px", color: "var(--dsw-alias-label-secondary)" } }, stack) : null
    );
  }
};
async function rpc(connection, method, payload) {
  const result = await connection.rpc.call("/api", RPC_ENDPOINT, { method, payload }, void 0);
  if (!result || result.ok !== true) {
    const error = new Error(result?.error?.message ?? t("\u8BF7\u6C42\u5931\u8D25", "Request failed"));
    error.code = result?.error?.code ?? "rpc-failed";
    throw error;
  }
  return result.value;
}
function FieldLabel({ label, hint }) {
  return h(
    "div",
    { style: S.labelrow },
    label ? h("span", { style: S.label }, label) : null,
    hint ? h(
      "span",
      {
        className: "bxf-tip",
        tabIndex: 0,
        role: "button",
        "aria-label": hint
      },
      h("span", { "aria-hidden": true }, "?"),
      h("span", { className: "bxf-tip-body", role: "tooltip" }, hint)
    ) : null
  );
}
function Field({ label, hint, children }) {
  return h(
    "div",
    null,
    label ? h(FieldLabel, { label, hint }) : null,
    children
  );
}
function Panel({ title, action, children, defaultOpen = false }) {
  const [open, setOpen] = import_react.default.useState(defaultOpen);
  return h(
    "section",
    { style: S.panel },
    h(
      "div",
      {
        className: "bxf-panel-head",
        style: S.panelHead,
        role: "button",
        tabIndex: 0,
        "aria-expanded": open,
        onClick: () => setOpen((value) => !value),
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }
      },
      h("span", { className: "bxf-panel-title" }, title),
      action ? h("div", { style: { marginLeft: "auto" }, onClick: (event) => event.stopPropagation() }, action) : null
    ),
    open ? h("div", { style: S.panelBody }, children) : null
  );
}
function StatusBadge({ state }) {
  const map = {
    connected: [t("\u8FD0\u884C\u6B63\u5E38", "Connected"), "ok"],
    connecting: [t("\u6B63\u5728\u8FDE\u63A5", "Connecting"), "warn"],
    reconnecting: [t("\u6B63\u5728\u91CD\u8FDE", "Reconnecting"), "warn"],
    error: [t("\u8FDE\u63A5\u5F02\u5E38", "Error"), "warn"],
    idle: [t("\u672A\u8FDE\u63A5", "Idle"), "muted"]
  };
  const [label, tone] = map[state] ?? map.idle;
  return h("span", { style: S.badge(tone) }, label);
}

// client/settings.js
var import_react4 = __toESM(require("react"), 1);

// client/bot.js
var import_react3 = __toESM(require("react"), 1);

// client/identity.js
var import_react2 = __toESM(require("react"), 1);
var h2 = import_react2.default.createElement;
function MonitorPanel({ connection }) {
  const [monitor, setMonitor] = import_react2.default.useState(null);
  const [available, setAvailable] = import_react2.default.useState(null);
  const [manual, setManual] = import_react2.default.useState("");
  const [manualMode, setManualMode] = import_react2.default.useState("p2p");
  const [busy, setBusy] = import_react2.default.useState("");
  const [error, setError] = import_react2.default.useState(null);
  const [drafts, setDrafts] = import_react2.default.useState([]);
  const load = import_react2.default.useCallback(async () => {
    try {
      const value = await rpc(connection, API.userMonitorStatus, {});
      setMonitor(value);
      setError(null);
      setDrafts(Array.isArray(value?.drafts) ? value.drafts : []);
      return value;
    } catch (failure) {
      setError(failure?.message ?? String(failure));
      return null;
    }
  }, [connection]);
  import_react2.default.useEffect(() => {
    void load();
  }, [load]);
  import_react2.default.useEffect(() => {
    const timer = setInterval(() => {
      void load();
    }, 1e4);
    return () => clearInterval(timer);
  }, [load]);
  const act = async (label, operation) => {
    setBusy(label);
    setError(null);
    try {
      const value = await operation();
      if (value) {
        setMonitor(value);
        setDrafts(Array.isArray(value.drafts) ? value.drafts : []);
      }
    } catch (failure) {
      setError(failure?.message ?? String(failure));
    } finally {
      setBusy("");
    }
  };
  const refreshChats = () => act("chats", async () => {
    const value = await rpc(connection, API.userMonitorChats, {});
    setAvailable(Array.isArray(value?.chats) ? value.chats : []);
    return null;
  });
  const add = (chat) => act(`add:${chat.chatId}`, () => rpc(connection, API.userMonitorAdd, chat));
  const remove = (chat) => act(`remove:${chat.chatId}`, () => rpc(connection, API.userMonitorRemove, { chatId: chat.chatId }));
  const setChat = (chat, patch) => act(`mode:${chat.chatId}`, () => rpc(connection, API.userMonitorChatSet, { chatId: chat.chatId, ...patch }));
  const sendDraft = (draft) => act(`send:${draft.draftId}`, async () => {
    await rpc(connection, API.userMonitorDraftSend, { draftId: draft.draftId });
    return null;
  });
  const ignoreDraft = (draft) => act(`ignore:${draft.draftId}`, async () => {
    await rpc(connection, API.userMonitorDraftIgnore, { draftId: draft.draftId });
    return null;
  });
  const toggle = () => act("toggle", () => rpc(connection, API.userMonitorEnable, {
    enabled: monitor?.enabled !== true
  }));
  const poll = () => act("poll", () => rpc(connection, API.userMonitorPoll, {}));
  const addManual = () => {
    const chatId = manual.trim();
    if (!chatId) return;
    void act("manual", async () => {
      const value = await rpc(connection, API.userMonitorAdd, { chatId, chatMode: manualMode });
      setManual("");
      return value;
    });
  };
  const act2 = async (label, operation) => act(label, operation);
  const markRead = () => act2("read", () => rpc(connection, API.userMonitorRead, {}));
  const clearAll = () => act2("clear", () => rpc(connection, API.userMonitorClear, {}));
  const chats = Array.isArray(monitor?.chats) ? monitor.chats : [];
  const pendingDrafts = drafts.filter((draft) => draft.status === "pending");
  const monitored = new Set(chats.map((chat) => chat.chatId));
  const candidates = (available ?? []).filter((chat) => !monitored.has(chat.chatId));
  const formatTime = (ms) => Number.isFinite(ms) && ms > 0 ? new Date(ms).toLocaleTimeString() : "\u2014";
  const chatRows = chats.length === 0 ? h2("p", { style: S.hint }, t("\u8FD8\u6CA1\u6709\u76D1\u542C\u4F1A\u8BDD\u3002\u70B9\u201C\u9009\u62E9\u4F1A\u8BDD\u201D\u6DFB\u52A0\u3002", "No monitored chats yet. Choose chats to add.")) : chats.map((chat) => h2(
    "div",
    {
      key: chat.chatId,
      style: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderTop: "1px solid var(--dsw-alias-border-l1)" }
    },
    h2(
      "div",
      { style: { flex: 1, minWidth: 0 } },
      h2("div", { style: { fontSize: "13px" } }, chat.name || chat.chatId),
      h2(
        "div",
        { style: S.hint },
        `${chat.chatMode === "p2p" ? t("\u79C1\u804A", "Direct") : t("\u7FA4\u804A", "Group")} \xB7 ${chat.chatId}`,
        chat.pendingBatch ? ` \xB7 ${t("\u5F85\u5904\u7406", "pending")} ${chat.pendingBatch}` : "",
        chat.lastAutoReplyAt ? ` \xB7 ${t("\u4E0A\u6B21\u81EA\u52A8\u56DE\u590D", "last auto")} ${formatTime(chat.lastAutoReplyAt)}` : "",
        chat.lastError ? h2("span", { style: { color: "var(--dsw-alias-state-error-primary)" } }, ` \xB7 ${chat.lastError}`) : null
      )
    ),
    h2(
      "select",
      {
        style: { ...S.input, width: "auto", height: "28px", fontSize: "12px" },
        value: chat.mode ?? (chat.chatMode === "p2p" ? "all" : "mention"),
        disabled: busy === `mode:${chat.chatId}`,
        onChange: (event) => void setChat(chat, { mode: event.target.value })
      },
      h2("option", { value: "all" }, t("\u5168\u90E8\u6D88\u606F", "All")),
      h2("option", { value: "mention" }, t("\u4EC5@\u6211/\u56DE\u590D\u6211", "Mentions & replies")),
      h2("option", { value: "keyword" }, t("\u5173\u952E\u8BCD", "Keywords"))
    ),
    chat.mode === "keyword" ? h2("input", {
      style: { ...S.input, width: "140px", height: "28px", fontSize: "12px" },
      defaultValue: (chat.keywords ?? []).join("\uFF0C"),
      placeholder: t("\u5173\u952E\u8BCD\uFF0C\u7528\u9017\u53F7\u5206\u9694", "Keywords, comma separated"),
      onBlur: (event) => {
        const keywords = event.target.value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
        void setChat(chat, { keywords });
      }
    }) : null,
    h2(
      "select",
      {
        style: { ...S.input, width: "auto", height: "28px", fontSize: "12px" },
        value: chat.replyMode === "auto" && chat.replyToBots ? "auto-bots" : chat.replyMode ?? "watch",
        disabled: busy === `mode:${chat.chatId}`,
        title: t("\u5904\u7406\u65B9\u5F0F", "Handling"),
        onChange: (event) => {
          const value = event.target.value;
          void setChat(chat, value === "auto-bots" ? { replyMode: "auto", replyToBots: true } : { replyMode: value, replyToBots: false });
        }
      },
      h2("option", { value: "watch" }, t("\u53EA\u8BB0\u5F55", "Record only")),
      h2("option", { value: "draft" }, t("\u751F\u6210\u8349\u7A3F", "Draft")),
      h2("option", { value: "auto" }, t("\u81EA\u52A8\u56DE\u590D", "Auto reply")),
      h2("option", { value: "auto-bots" }, t("\u81EA\u52A8\u56DE\u590D\uFF08\u542B\u673A\u5668\u4EBA\uFF09", "Auto reply (bots too)"))
    ),
    h2(
      "button",
      { type: "button", className: "bxf-mini", disabled: busy === `remove:${chat.chatId}`, onClick: () => void remove(chat) },
      t("\u79FB\u9664", "Remove")
    )
  ));
  const candidateRows = available ? candidates.length === 0 ? h2("p", { style: S.hint }, t("\u6CA1\u6709\u53EF\u6DFB\u52A0\u7684\u4F1A\u8BDD\u3002", "No chats available to add.")) : h2(
    "div",
    { style: { display: "grid", gap: "4px", maxHeight: "220px", overflow: "auto" } },
    candidates.slice(0, 300).map((chat) => h2(
      "div",
      {
        key: chat.chatId,
        style: { display: "flex", alignItems: "center", gap: "8px", padding: "5px 0" }
      },
      h2(
        "div",
        { style: { flex: 1, minWidth: 0 } },
        h2("div", { style: { fontSize: "13px" } }, chat.name || chat.chatId),
        h2("div", { style: S.hint }, chat.chatMode === "p2p" ? t("\u79C1\u804A", "Direct") : t("\u7FA4\u804A", "Group"))
      ),
      h2(
        "button",
        { type: "button", className: "bxf-mini", disabled: busy === `add:${chat.chatId}`, onClick: () => void add(chat) },
        t("\u6DFB\u52A0", "Add")
      )
    ))
  ) : null;
  return h2(
    Panel,
    {
      title: t("\u6D88\u606F\u76D1\u542C", "Message monitoring"),
      defaultOpen: true,
      action: h2("button", {
        type: "button",
        className: "bxf-mini",
        disabled: busy === "toggle",
        onClick: () => void toggle()
      }, monitor?.enabled ? t("\u505C\u6B62\u76D1\u542C", "Stop") : t("\u5F00\u59CB\u76D1\u542C", "Start"))
    },
    h2(
      "p",
      { style: { ...S.hint, margin: "0 0 10px" } },
      t(
        "\u5B9A\u65F6\u68C0\u67E5\u5DF2\u9009\u4F1A\u8BDD\u7684\u65B0\u6D88\u606F\uFF0C\u8BB0\u5F55\u5230\u672C\u5730\u6536\u4EF6\u7BB1\u3002\u65B0\u589E\u76D1\u542C\u4ECE\u5F53\u524D\u65F6\u95F4\u5F00\u59CB\uFF0C\u4E0D\u56DE\u8865\u5386\u53F2\uFF1B\u4E0D\u8C03\u7528\u6A21\u578B\uFF0C\u4E5F\u4E0D\u81EA\u52A8\u56DE\u590D\u3002",
        "Polls selected chats into a local inbox. New monitors start at the current time and do not backfill; no model calls and no automatic replies."
      ),
      h2("br"),
      t(
        "\u4F1A\u8BDD\u5217\u8868\u5DF2\u540C\u65F6\u5305\u542B\u7FA4\u804A\u548C\u6700\u8FD1\u79C1\u804A\uFF1B\u627E\u4E0D\u5230\u65F6\u53EF\u624B\u52A8\u586B chat_id\u3002",
        "The picker includes groups and recent direct chats; enter a chat_id manually if one is missing."
      )
    ),
    error ? h2("div", { style: S.error }, error) : null,
    !monitor ? h2("p", { style: S.hint }, t("\u6B63\u5728\u8BFB\u53D6\u76D1\u542C\u72B6\u6001\u2026", "Loading monitor status\u2026")) : h2(
      "div",
      { style: { display: "grid", gap: "8px" } },
      h2(
        "div",
        { style: S.row },
        h2(
          "span",
          { style: S.badge(monitor.enabled ? "ok" : "muted") },
          monitor.enabled ? t("\u76D1\u542C\u4E2D", "Watching") : t("\u5DF2\u6682\u505C", "Paused")
        ),
        h2("span", { style: S.hint }, `${t("\u6700\u540E\u68C0\u67E5", "Last check")}\uFF1A${formatTime(chats[0]?.lastPollAt)}`),
        h2(
          "button",
          { type: "button", className: "bxf-mini", disabled: busy === "poll", onClick: () => void poll() },
          t("\u7ACB\u5373\u68C0\u67E5", "Check now")
        )
      ),
      pendingDrafts.length > 0 ? h2(
        "div",
        { style: { display: "grid", gap: "6px", paddingTop: "6px", borderTop: "1px solid var(--dsw-alias-border-l1)" } },
        h2("div", { style: { fontSize: "12px", fontWeight: 600 } }, `${pendingDrafts.length} ${t("\u6761\u5F85\u786E\u8BA4\u8349\u7A3F", "drafts to confirm")}`),
        pendingDrafts.map((draft) => h2(
          "div",
          {
            key: draft.draftId,
            style: { display: "grid", gap: "4px", padding: "6px", borderRadius: "8px", background: "var(--dsw-alias-bg-layer-2)" }
          },
          h2("div", { style: S.hint }, `${draft.chatName || draft.chatId}${draft.replyToMessageId ? ` \xB7 ${t("\u56DE\u590D\u6D88\u606F", "reply")}` : ""}`),
          h2("div", { style: { fontSize: "13px", whiteSpace: "pre-wrap" } }, draft.text),
          h2(
            "div",
            { style: S.row },
            h2(
              "button",
              { type: "button", className: "bxf-mini", disabled: busy === `send:${draft.draftId}`, onClick: () => void sendDraft(draft) },
              t("\u53D1\u9001", "Send")
            ),
            h2(
              "button",
              { type: "button", className: "bxf-mini", disabled: busy === `ignore:${draft.draftId}`, onClick: () => void ignoreDraft(draft) },
              t("\u5FFD\u7565", "Ignore")
            )
          )
        ))
      ) : null,
      chatRows,
      monitor.unreadTotal > 0 ? h2(
        "div",
        { style: { display: "grid", gap: "6px", paddingTop: "6px", borderTop: "1px solid var(--dsw-alias-border-l1)" } },
        h2(
          "div",
          { style: S.row },
          h2("span", { style: S.badge("warn") }, `${monitor.unreadTotal} ${t("\u6761\u672A\u8BFB", "unread")}`),
          h2(
            "button",
            { type: "button", className: "bxf-mini", disabled: busy === "read", onClick: () => void markRead() },
            t("\u5168\u90E8\u5DF2\u8BFB", "Mark read")
          ),
          h2(
            "button",
            { type: "button", className: "bxf-mini", disabled: busy === "clear", onClick: () => void clearAll() },
            t("\u6E05\u7A7A\u8BB0\u5F55", "Clear")
          )
        ),
        chats.filter((chat) => (chat.messages ?? []).some((message) => !message.read)).map((chat) => h2(
          "div",
          { key: `m:${chat.chatId}`, style: { display: "grid", gap: "2px" } },
          h2("div", { style: S.hint }, `${chat.name || chat.chatId}${chat.unread ? ` \xB7 ${chat.unread}` : ""}`),
          (chat.messages ?? []).filter((message) => !message.read).slice(-3).map((message) => h2("div", {
            key: message.messageId,
            style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
          }, `${message.senderName || t("\u672A\u77E5", "Unknown")}\uFF1A${message.text}`))
        ))
      ) : null,
      h2(
        "div",
        { style: { ...S.row, marginTop: "4px" } },
        h2(
          "button",
          { type: "button", className: "bxf-mini", disabled: busy === "chats", onClick: () => void refreshChats() },
          busy === "chats" ? t("\u6B63\u5728\u8BFB\u53D6\u2026", "Loading\u2026") : t("\u9009\u62E9\u4F1A\u8BDD", "Choose chats")
        )
      ),
      candidateRows,
      h2(
        "div",
        { style: { ...S.row, marginTop: "4px" } },
        h2("input", {
          style: { ...S.input, flex: 1, minWidth: 0 },
          value: manual,
          placeholder: t("\u624B\u52A8\u586B chat_id\uFF08oc_\u2026\uFF09", "Enter chat_id (oc_\u2026)"),
          onChange: (event) => setManual(event.target.value)
        }),
        h2(
          "select",
          {
            style: S.input,
            value: manualMode,
            onChange: (event) => setManualMode(event.target.value)
          },
          h2("option", { value: "p2p" }, t("\u79C1\u804A", "Direct")),
          h2("option", { value: "group" }, t("\u7FA4\u804A", "Group"))
        ),
        h2(
          "button",
          { type: "button", className: "bxf-mini", disabled: busy === "manual" || !manual.trim(), onClick: addManual },
          t("\u6DFB\u52A0", "Add")
        )
      )
    )
  );
}
function UserIdentityModal({ connection, bot, status, error, onClose, onRefresh }) {
  const [busy, setBusy] = import_react2.default.useState("");
  const [notice, setNotice] = import_react2.default.useState(null);
  const [confirmDisconnect, setConfirmDisconnect] = import_react2.default.useState(false);
  const currentApp = status?.config?.app;
  const currentBot = Boolean(currentApp?.botId && bot?.id && currentApp.botId === bot.id);
  const pending = status?.connect?.phase === "pending" && currentBot;
  const requestClose = import_react2.default.useCallback(() => {
    if (pending) {
      void rpc(connection, API.userConnectCancel, {}).then(onRefresh).catch(() => void 0);
    }
    onClose();
  }, [pending, connection, onRefresh, onClose]);
  import_react2.default.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);
  import_react2.default.useEffect(() => {
    if (!confirmDisconnect) return void 0;
    const timer = setTimeout(() => setConfirmDisconnect(false), 4e3);
    return () => clearTimeout(timer);
  }, [confirmDisconnect]);
  const run = async (label, operation) => {
    setBusy(label);
    setNotice(null);
    try {
      await operation();
    } catch (failure) {
      setNotice({ tone: "error", text: failure?.message ?? String(failure) });
    } finally {
      setBusy("");
    }
  };
  const connect = () => run("connect", async () => {
    const value = await rpc(connection, API.userConnectBegin, { botId: bot.id });
    if (value?.url && !value?.qrCodeDataUrl) window.open(value.url, "_blank", "noopener,noreferrer");
    await onRefresh();
    if (!value?.url) setNotice({ tone: "error", text: t("\u6CA1\u6709\u62FF\u5230\u98DE\u4E66\u6388\u6743\u94FE\u63A5", "No authorization URL returned") });
  });
  const disconnect = () => run("disconnect", async () => {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      return;
    }
    await rpc(connection, API.userDisconnect, {});
    setConfirmDisconnect(false);
    await onRefresh();
    setNotice({ tone: "ok", text: t("\u5DF2\u65AD\u5F00\u6388\u6743", "Disconnected") });
  });
  const refreshToken = () => run("refresh", async () => {
    await rpc(connection, API.userRefresh, {});
    await onRefresh();
    setNotice({ tone: "ok", text: t("token \u5DF2\u5237\u65B0", "Token refreshed") });
  });
  const authorized = Boolean(status?.authorization?.authorized) && currentBot;
  const user = status?.authorization?.user;
  const formatTime = (ms) => Number.isFinite(ms) && ms > 0 ? new Date(ms).toLocaleString() : "\u2014";
  let body;
  if (!status) {
    body = h2(
      "div",
      { style: { display: "grid", gap: "8px" } },
      error ? h2("div", { style: S.error }, error) : h2("p", { style: S.hint }, t("\u6B63\u5728\u8BFB\u53D6\u2026", "Loading\u2026")),
      h2(
        "div",
        { style: S.row },
        h2("button", { type: "button", style: S.btn(), onClick: () => void onRefresh() }, t("\u91CD\u8BD5", "Retry"))
      )
    );
  } else if (pending) {
    body = h2(
      "div",
      { style: { display: "grid", gap: "8px" } },
      h2(
        "p",
        { style: { ...S.sub, margin: 0 } },
        t("\u626B\u7801\u540E\u5728\u98DE\u4E66\u786E\u8BA4\u3002", "Confirm in Feishu after scanning.")
      ),
      status.connect?.qrCodeDataUrl ? h2(
        "div",
        { style: { display: "flex", justifyContent: "center" } },
        h2("div", {
          style: {
            padding: "10px",
            background: "#fff",
            borderRadius: "12px",
            lineHeight: 0,
            border: "1px solid var(--dsw-alias-border-l1)",
            boxShadow: "0 2px 10px rgba(15,23,42,.08)"
          }
        }, h2("img", { src: status.connect.qrCodeDataUrl, width: 180, height: 180, alt: "QR" }))
      ) : null
    );
  } else if (authorized) {
    body = h2(
      "div",
      { style: { display: "grid", gap: "8px" } },
      h2(
        "div",
        { style: S.row },
        h2("strong", { style: { fontSize: "14px" } }, user?.name || t("\u672A\u547D\u540D\u7528\u6237", "Unnamed user")),
        h2("span", { style: S.badge("ok") }, t("\u5DF2\u8FDE\u63A5", "Connected"))
      ),
      h2("div", { style: S.hint }, `open_id\uFF1A${user?.openId || "\u2014"}`),
      h2("div", { style: S.hint }, `${t("access_token \u5230\u671F", "access_token expires")}\uFF1A${formatTime(status.authorization?.accessTokenExpiresAt)}`),
      h2("div", { style: S.hint }, `${t("refresh_token \u5230\u671F", "refresh_token expires")}\uFF1A${formatTime(status.authorization?.refreshTokenExpiresAt)}`),
      status.authorization?.scopeSatisfied === false ? h2(
        "div",
        { style: S.error },
        `${t("\u5F53\u524D\u6388\u6743\u7F3A\u5C11\u6743\u9650\uFF0C\u8BF7\u91CD\u65B0\u6388\u6743\uFF1A", "Authorization is missing scopes; re-authorize: ")}${(status.authorization.missingScopes ?? []).slice(0, 6).join("\u3001")}${(status.authorization.missingScopes?.length ?? 0) > 6 ? " \u2026" : ""}`
      ) : null,
      h2(
        "div",
        { style: S.row },
        h2(
          "button",
          { type: "button", style: S.btn(), disabled: busy === "connect", onClick: () => void connect() },
          t("\u91CD\u65B0\u6388\u6743", "Re-authorize")
        ),
        h2(
          "button",
          { type: "button", style: S.btn(), disabled: busy === "refresh", onClick: () => void refreshToken() },
          busy === "refresh" ? t("\u5237\u65B0\u4E2D\u2026", "Refreshing\u2026") : t("\u5237\u65B0 token", "Refresh token")
        ),
        h2(
          "button",
          { type: "button", style: { ...S.btn(), color: "var(--dsw-alias-state-error-primary)" }, disabled: busy === "disconnect", onClick: () => void disconnect() },
          confirmDisconnect ? t("\u786E\u8BA4\u65AD\u5F00\uFF1F", "Confirm disconnect?") : t("\u65AD\u5F00\u6388\u6743", "Disconnect")
        )
      ),
      h2(MonitorPanel, { connection })
    );
  } else {
    body = h2(
      "div",
      { style: { display: "grid", gap: "8px" } },
      h2(
        "div",
        { style: S.row },
        h2("button", {
          type: "button",
          style: S.btn("primary"),
          disabled: busy === "connect",
          onClick: () => void connect()
        }, busy === "connect" ? t("\u6B63\u5728\u53D1\u8D77\u2026", "Starting\u2026") : t("\u8FDE\u63A5\u98DE\u4E66", "Connect Feishu")),
        h2("button", { type: "button", style: S.btn(), onClick: () => void onRefresh() }, t("\u5237\u65B0\u72B6\u6001", "Refresh"))
      )
    );
  }
  return h2(
    "div",
    {
      style: S.overlay,
      role: "dialog",
      "aria-modal": true,
      "aria-label": t("\u98DE\u4E66\u5206\u8EAB", "Feishu identity"),
      onClick: (event) => {
        if (event.target === event.currentTarget) requestClose();
      }
    },
    h2(
      "div",
      { style: S.modal },
      notice ? h2("div", {
        style: {
          ...S.hint,
          marginTop: "10px",
          color: notice.tone === "error" ? "var(--dsw-alias-state-error-primary)" : "var(--dsw-alias-state-success-primary)"
        }
      }, notice.text) : null,
      !notice && error ? h2("div", { style: { ...S.error, marginTop: "10px" } }, error) : null,
      h2("div", { style: { marginTop: "12px" } }, body),
      h2(
        "div",
        { style: { ...S.row, justifyContent: "flex-end", marginTop: "16px" } },
        h2(
          "button",
          { type: "button", style: S.btn("primary"), onClick: requestClose },
          pending ? t("\u53D6\u6D88\u6388\u6743", "Cancel authorization") : t("\u5173\u95ED", "Close")
        )
      )
    )
  );
}
function UserIdentityButton({ connection, bot }) {
  const [status, setStatus] = import_react2.default.useState(null);
  const [error, setError] = import_react2.default.useState(null);
  const [open, setOpen] = import_react2.default.useState(false);
  const load = import_react2.default.useCallback(async () => {
    try {
      const value = await rpc(connection, API.userStatus, {});
      setStatus(value);
      setError(null);
      return value;
    } catch (failure) {
      setError(failure?.message ?? String(failure));
      return null;
    }
  }, [connection]);
  import_react2.default.useEffect(() => {
    void load();
  }, [load]);
  import_react2.default.useEffect(() => {
    if (status?.connect?.phase !== "pending") return void 0;
    const timer = setInterval(() => {
      void load();
    }, 1500);
    return () => clearInterval(timer);
  }, [status?.connect?.phase, load]);
  const currentApp = status?.config?.app;
  const currentBot = Boolean(currentApp?.botId && bot?.id && currentApp.botId === bot.id);
  const authorized = Boolean(status?.authorization?.authorized) && currentBot;
  const pending = status?.connect?.phase === "pending" && currentBot;
  const label = authorized ? `${t("\u5206\u8EAB", "Identity")}\uFF1A${status.authorization.user?.name || t("\u5DF2\u8FDE\u63A5", "Connected")}` : t("\u5206\u8EAB", "Identity");
  return h2(
    "div",
    { style: { display: "flex", alignItems: "center" } },
    h2("button", {
      type: "button",
      className: "bxf-mini",
      onClick: () => {
        setOpen(true);
        void load();
      }
    }, label),
    open ? h2(UserIdentityModal, {
      connection,
      bot,
      status,
      error,
      onClose: () => setOpen(false),
      onRefresh: async () => {
        const value = await load();
        return value;
      }
    }) : null
  );
}

// client/bot.js
var h3 = import_react3.default.createElement;
function AddBotModal({ connection, mode = "manual", grant = null, onClose, onAdded }) {
  const [form, setForm] = import_react3.default.useState({ appId: "", appSecret: "" });
  const [busy, setBusy] = import_react3.default.useState(false);
  const [error, setError] = import_react3.default.useState(null);
  const [scan, setScan] = import_react3.default.useState(null);
  const [remaining, setRemaining] = import_react3.default.useState(0);
  const deadline = import_react3.default.useRef(0);
  const timer = import_react3.default.useRef(null);
  const stop = import_react3.default.useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);
  import_react3.default.useEffect(() => stop, [stop]);
  const startScan = async () => {
    setBusy(true);
    setError(null);
    try {
      const snapshot = await rpc(connection, API.provisionBegin, grant ? { botId: grant.id } : {});
      setScan(snapshot);
      if (snapshot.state === "success") {
        onAdded();
        onClose();
        return;
      }
      stop();
      deadline.current = Date.now() + 5 * 6e4;
      setRemaining(5 * 60);
      timer.current = setInterval(async () => {
        try {
          const next = await rpc(connection, API.provisionPoll, {});
          setScan(next);
          if (["success", "denied", "expired", "error", "cancelled"].includes(next.state)) {
            stop();
            if (next.state === "success") {
              onAdded();
              onClose();
            }
          }
        } catch (cause) {
          stop();
          setError(cause.message);
        }
      }, Math.max(2e3, snapshot.nextPollInMs ?? 3e3));
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  const cancelScan = () => {
    stop();
    void rpc(connection, API.provisionCancel, {}).catch(() => void 0);
    setScan(null);
    setRemaining(0);
    onClose();
  };
  import_react3.default.useEffect(() => {
    if (!scan) return void 0;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((deadline.current - Date.now()) / 1e3));
      setRemaining(left);
      if (left === 0) {
        clearInterval(id);
        stop();
        void rpc(connection, API.provisionCancel, {}).catch(() => void 0);
        setScan(null);
        onClose();
      }
    }, 1e3);
    return () => clearInterval(id);
  }, [scan, connection, onClose, stop]);
  import_react3.default.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  import_react3.default.useEffect(() => {
    if (mode === "scan") void startScan();
  }, [mode]);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await rpc(connection, API.botAdd, form);
      onAdded();
      onClose();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  return h3(
    "div",
    { style: S.overlay, role: "dialog", "aria-modal": true, onClick: (event) => {
      if (event.target === event.currentTarget) onClose();
    } },
    h3(
      "div",
      { style: S.modal },
      h3(
        "h3",
        { style: { margin: "0 0 4px", fontSize: "15px" } },
        mode === "scan" ? grant ? t("\u626B\u7801\u8865\u9F50\u6743\u9650", "Grant by scanning") : t("\u626B\u7801\u6DFB\u52A0\u673A\u5668\u4EBA", "Add by scanning") : t("\u624B\u52A8\u6DFB\u52A0\u673A\u5668\u4EBA", "Add manually")
      ),
      mode === "scan" ? h3(
        "div",
        { style: { display: "grid", justifyItems: "center", gap: "8px", marginTop: "10px" } },
        scan?.qrCodeDataUrl ? h3("div", {
          style: {
            padding: "10px",
            background: "#fff",
            borderRadius: "12px",
            lineHeight: 0,
            border: "1px solid var(--dsw-alias-border-l1)",
            boxShadow: "0 2px 10px rgba(15,23,42,.08)"
          }
        }, h3("img", { src: scan.qrCodeDataUrl, width: 200, height: 200, alt: "QR" })) : h3("div", {
          style: {
            width: "200px",
            height: "200px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "10px",
            background: "var(--dsw-alias-bg-layer-2)",
            color: "var(--dsw-alias-label-secondary)",
            fontSize: "12px"
          }
        }, t("\u6B63\u5728\u751F\u6210\u4E8C\u7EF4\u7801\u2026", "Preparing QR\u2026")),
        h3(
          "div",
          { style: { ...S.hint, textAlign: "center" } },
          scan ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} \xB7 ${scan.state === "pending" || scan.state === "qr_ready" ? t("\u7B49\u5F85\u626B\u7801\u786E\u8BA4", "Waiting for scan") : scan.state === "slow_down" ? t("\u8BF7\u5728\u98DE\u4E66\u91CC\u786E\u8BA4", "Confirm in Feishu") : scan.state === "denied" ? t("\u5DF2\u5728\u98DE\u4E66\u91CC\u53D6\u6D88", "Cancelled in Feishu") : scan.state === "expired" ? t("\u5DF2\u8FC7\u671F", "Expired") : scan.state === "success" ? t("\u5DF2\u751F\u6548", "Applied") : scan.state}` : t("\u8BF7\u7A0D\u5019\u2026", "Please wait\u2026")
        ),
        error ? h3("div", { style: S.error }, error) : null,
        h3(
          "div",
          { style: { display: "flex", gap: "8px" } },
          h3("button", { type: "button", style: S.btn(), onClick: cancelScan }, t("\u53D6\u6D88\u626B\u7801", "Stop")),
          scan && ["denied", "expired", "error", "cancelled"].includes(scan.state) ? h3("button", { type: "button", style: S.btn("primary"), onClick: startScan }, t("\u91CD\u65B0\u751F\u6210", "Retry")) : null
        )
      ) : null,
      mode === "manual" ? h3("p", { style: S.hint }, t("\u98DE\u4E66\u5F00\u653E\u5E73\u53F0 \u2192 \u81EA\u5EFA\u5E94\u7528 \u2192 \u51ED\u8BC1\u4E0E\u57FA\u7840\u4FE1\u606F\uFF0C\u590D\u5236 App ID \u4E0E App Secret\u3002", "Feishu console \u2192 custom app \u2192 credentials.")) : null,
      h3(
        "div",
        { style: { ...S.panelBody, display: mode === "manual" ? "grid" : "none" } },
        h3(
          Field,
          { label: "App ID" },
          h3("input", { style: S.input, value: form.appId, placeholder: "cli_xxxxxxxxxxxxxxxx", onChange: (event) => setForm({ ...form, appId: event.target.value }) })
        ),
        h3(
          Field,
          { label: "App Secret", hint: t("\u53EA\u63D0\u4EA4\u7ED9\u672C\u673A Host\uFF0C\u5199\u5165 DSH \u51ED\u636E\u5E93\uFF0C\u4E0D\u4F1A\u56DE\u4F20\u6D4F\u89C8\u5668\u3002", "Stored by the local Host credential service; never returned.") },
          h3("input", { style: S.input, type: "password", value: form.appSecret, onChange: (event) => setForm({ ...form, appSecret: event.target.value }) })
        ),
        error ? h3("div", { style: S.error }, error) : null
      ),
      h3(
        "div",
        { style: { ...S.row, justifyContent: "flex-end", marginTop: "14px" } },
        mode === "manual" ? h3("button", { type: "button", style: S.btn(), onClick: onClose, disabled: busy }, t("\u53D6\u6D88", "Cancel")) : null,
        mode === "manual" ? h3(
          "button",
          { type: "button", style: S.btn("primary"), onClick: submit, disabled: busy || !form.appId || !form.appSecret },
          busy ? t("\u6B63\u5728\u9A8C\u8BC1\u2026", "Verifying\u2026") : t("\u7ED1\u5B9A\u5E76\u8FDE\u63A5", "Bind and connect")
        ) : null
      )
    )
  );
}
function AliasModal({ connection, bot, onClose, onSaved }) {
  const [value, setValue] = import_react3.default.useState(bot.alias ?? "");
  const [color, setColor] = import_react3.default.useState(bot.color ?? "blue");
  const [busy, setBusy] = import_react3.default.useState(false);
  const [error, setError] = import_react3.default.useState(null);
  import_react3.default.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await rpc(connection, API.botAliasSet, { botId: bot.id, alias: value.trim() || null });
      await rpc(connection, API.botColorSet, { botId: bot.id, color });
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  return h3(
    "div",
    { style: S.overlay, role: "dialog", "aria-modal": true, onClick: (event) => {
      if (event.target === event.currentTarget) onClose();
    } },
    h3(
      "div",
      { style: S.modal },
      h3("h3", { style: { margin: "0 0 4px", fontSize: "15px" } }, t("\u5916\u89C2\u4E0E\u540D\u79F0", "Appearance")),
      h3("p", { style: S.hint }, t("\u53EA\u5728\u672C\u63D2\u4EF6\u91CC\u5C55\u793A\uFF0C\u4E0D\u5F71\u54CD\u98DE\u4E66\u4E2D\u7684\u673A\u5668\u4EBA\u540D\u79F0\uFF1B\u7559\u7A7A\u6062\u590D\u5E94\u7528\u539F\u540D\u3002", "Shown only in this plugin; empty restores the app name.")),
      h3(
        "div",
        { style: S.panelBody },
        h3("input", {
          style: S.input,
          value,
          autoFocus: true,
          placeholder: bot.botName ?? "\u5C0F\u52A9\u624B",
          onChange: (event) => setValue(event.target.value),
          onKeyDown: (event) => {
            if (event.key === "Enter") void save();
          }
        }),
        h3(
          "div",
          null,
          h3("label", { style: S.label }, t("\u6807\u8BC6\u8272", "Accent color")),
          h3(
            "div",
            { style: { display: "flex", gap: "8px" } },
            Object.entries(BOT_COLORS).map(([key, palette]) => h3("button", {
              key,
              type: "button",
              title: text(COLOR_NAMES[key]),
              "aria-label": text(COLOR_NAMES[key]),
              onClick: () => setColor(key),
              style: {
                width: "26px",
                height: "26px",
                borderRadius: "50%",
                cursor: "pointer",
                background: palette.main,
                border: color === key ? "2px solid var(--dsw-alias-label-primary)" : "2px solid transparent",
                boxShadow: color === key ? "0 0 0 2px var(--dsw-alias-bg-layer-1) inset" : "none"
              }
            }))
          )
        ),
        error ? h3("div", { style: S.error }, error) : null
      ),
      h3(
        "div",
        { style: { ...S.row, justifyContent: "flex-end", marginTop: "14px" } },
        h3("button", { type: "button", style: S.btn(), onClick: onClose, disabled: busy }, t("\u53D6\u6D88", "Cancel")),
        h3("button", { type: "button", style: S.btn("primary"), onClick: save, disabled: busy }, busy ? t("\u4FDD\u5B58\u4E2D\u2026", "Saving\u2026") : t("\u4FDD\u5B58", "Save"))
      )
    )
  );
}
function DetailsModal({ bot, onClose, onGrant }) {
  const [copied, setCopied] = import_react3.default.useState(false);
  import_react3.default.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const rows = [
    [t("\u72B6\u6001", "State"), bot.state],
    [t("\u5E94\u7528 ID", "App ID"), bot.appIdMasked ?? bot.appId],
    [t("\u673A\u5668\u4EBA", "Bot"), bot.botName],
    [t("\u673A\u5668\u4EBA Open ID", "Bot Open ID"), bot.botOpenId],
    [t("\u7ED1\u5B9A\u4F1A\u8BDD", "Bound chats"), String(bot.boundChats ?? 0)],
    [t("\u5DE5\u4F5C\u533A", "Workspace"), bot.workspace ?? "\u2014"],
    [t("\u9ED8\u8BA4\u6A21\u578B", "Model"), bot.model ? `${bot.model.provider} \xB7 ${bot.model.model}${bot.model.reasoningEffort ? ` \xB7 ${bot.model.reasoningEffort}` : ""}` : "\u2014"],
    [t("Agent \u9884\u8BBE", "Agent preset"), bot.agentPreset ?? "\u2014"],
    [t("\u8FDE\u63A5\u65F6\u95F4", "Connected at"), bot.connectedAt ?? "\u2014"],
    [t("\u6700\u8FD1\u9519\u8BEF", "Last error"), bot.lastError ? `${bot.lastError.code}\uFF1A${bot.lastError.message}` : "\u2014"]
  ];
  const copy = () => {
    void navigator.clipboard?.writeText(JSON.stringify(bot, null, 2)).then(() => setCopied(true), () => setCopied(false));
  };
  return h3(
    "div",
    { style: S.overlay, role: "dialog", "aria-modal": true, onClick: (event) => {
      if (event.target === event.currentTarget) onClose();
    } },
    h3(
      "div",
      { style: S.modal },
      h3("h3", { style: { margin: "0 0 10px", fontSize: "15px" } }, t("\u8FDE\u63A5\u8BE6\u60C5", "Connection details")),
      h3(
        "div",
        { style: { display: "grid", gap: "6px" } },
        rows.map(([key, value]) => h3(
          "div",
          { key, style: { display: "flex", gap: "10px", fontSize: "12px" } },
          h3("span", { style: { width: "96px", color: "var(--dsw-alias-label-secondary, #6b7280)", flex: "none" } }, key),
          h3("span", { style: { wordBreak: "break-all" } }, value ?? "\u2014")
        ))
      ),
      h3(
        "div",
        { style: { borderTop: "1px solid var(--dsw-alias-border-l1, #e5e7eb)", marginTop: "14px", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" } },
        h3(
          "span",
          { style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary, #6b7280)" } },
          t("\u7F3A\u5C11\u6743\u9650\u65F6\uFF0C\u626B\u7801\u4E00\u6B21\u5373\u53EF\u8865\u9F50", "Scan once to grant the required permissions")
        ),
        h3(
          "button",
          { type: "button", style: S.btn("primary"), onClick: onGrant },
          t("\u8865\u9F50\u6743\u9650", "Grant permissions")
        )
      ),
      h3(
        "div",
        { style: { ...S.row, justifyContent: "flex-end", marginTop: "16px" } },
        h3("button", { type: "button", style: S.btn(), onClick: copy }, copied ? t("\u5DF2\u590D\u5236", "Copied") : t("\u590D\u5236", "Copy")),
        h3("button", { type: "button", style: S.btn("primary"), onClick: onClose }, t("\u5173\u95ED", "Close"))
      )
    )
  );
}
function BotCard({ connection, bot, models, presets, workspaces, permissionOptions, onChanged }) {
  const [open, setOpen] = import_react3.default.useState(false);
  const [aliasOpen, setAliasOpen] = import_react3.default.useState(false);
  const [detailsOpen, setDetailsOpen] = import_react3.default.useState(false);
  const [grantOpen, setGrantOpen] = import_react3.default.useState(false);
  const [draft, setDraft] = import_react3.default.useState(null);
  const [baseline, setBaseline] = import_react3.default.useState(null);
  const [busy, setBusy] = import_react3.default.useState(null);
  const [error, setError] = import_react3.default.useState(null);
  const [notice, setNotice] = import_react3.default.useState(null);
  import_react3.default.useEffect(() => {
    if (!notice) return void 0;
    const timer = setTimeout(() => setNotice(null), 3e3);
    return () => clearTimeout(timer);
  }, [notice]);
  const seed = import_react3.default.useCallback((source = bot) => {
    const enhancement = source.contextEnhancement ?? emptyEnhancement();
    return {
      alias: source.alias ?? "",
      workspace: source.workspace ?? "",
      workspaceMode: source.workspace ?? "",
      workspaceCustom: source.workspace ?? "",
      provider: source.model?.provider ?? "",
      model: source.model?.model ?? "",
      reasoningEffort: source.model?.reasoningEffort ?? "",
      preset: source.agentPreset ?? "",
      busyMode: {
        direct: (source.busyMode && typeof source.busyMode === "object" ? source.busyMode.direct : source.busyMode) ?? "queue",
        group: (source.busyMode && typeof source.busyMode === "object" ? source.busyMode.group : source.busyMode) ?? "queue"
      },
      contextEnhancement: {
        group: { ...emptyScope(), ...enhancement.group ?? {}, enabled: true },
        direct: { ...emptyScope(), ...enhancement.direct ?? {}, enabled: true }
      },
      respondBot: source.respondToBotMessages !== false,
      topics: source.topicsEnabled !== false,
      processDetail: source.processDetail === "brief" ? "brief" : "detailed",
      permissionPreset: source.permissionPreset ?? "",
      eavesdrop: {
        enabled: source.eavesdrop?.enabled !== false,
        limit: Number.isFinite(Number(source.eavesdrop?.limit)) && Number(source.eavesdrop?.limit) > 0 ? Math.min(500, Number(source.eavesdrop.limit)) : 20
      },
      mentions: {
        enabled: source.mentions?.enabled !== false,
        allowAll: source.mentions?.allowAll === true
      },
      group: source.access?.group ?? "all",
      allow: (source.access?.allowOpenIds ?? []).join(", "),
      managers: (source.access?.managers ?? []).join(", ")
    };
  }, [bot]);
  const seedRef = import_react3.default.useRef(seed);
  seedRef.current = seed;
  import_react3.default.useEffect(() => {
    const initial = seedRef.current();
    setDraft(initial);
    setBaseline(initial);
  }, [bot.id]);
  const run = async (key, task) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await task();
      setNotice(t("\u5DF2\u4FDD\u5B58", "Saved"));
      try {
        const fresh = await rpc(connection, API.botsList, {});
        const latest = (fresh?.bots ?? []).find((item) => item.id === bot.id);
        if (latest) {
          const initial = seed(latest);
          setDraft(initial);
          setBaseline(initial);
        }
      } catch {
        const snap = groupSnapshot(draft ?? {});
        setBaseline((previous) => ({ ...previous ?? draft ?? {}, ...snap }));
      }
      onChanged();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(null);
    }
  };
  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const saveModel = () => rpc(connection, API.botModelSet, {
    botId: bot.id,
    model: draft.provider && draft.model ? { provider: draft.provider, model: draft.model, ...draft.reasoningEffort ? { reasoningEffort: draft.reasoningEffort } : {} } : null
  });
  const saveAccess = () => rpc(connection, API.botAccessSet, {
    botId: bot.id,
    access: {
      group: draft.group,
      allowOpenIds: draft.allow.split(/[\s,;，；、]+/).map((item) => item.trim()).filter(Boolean),
      managers: draft.managers.split(/[\s,;，；、]+/).map((item) => item.trim()).filter(Boolean)
    }
  });
  const groupSnapshot = (value) => ({
    general: {
      workspace: value.workspace,
      provider: value.provider,
      model: value.model,
      reasoningEffort: value.reasoningEffort,
      preset: value.preset,
      processDetail: value.processDetail,
      permissionPreset: value.permissionPreset
    },
    direct: { busyMode: value.busyMode?.direct, ce: value.contextEnhancement?.direct },
    group: {
      busyMode: value.busyMode?.group,
      group: value.group,
      allow: value.allow,
      managers: value.managers,
      ce: value.contextEnhancement?.group,
      respondBot: value.respondBot,
      topics: value.topics,
      eavesdrop: value.eavesdrop,
      mentions: value.mentions
    }
  });
  const isDirty = (name) => {
    if (!draft || !baseline) return false;
    return JSON.stringify(groupSnapshot(draft)[name]) !== JSON.stringify(groupSnapshot(baseline)[name]);
  };
  const saveGeneral = () => run("g", async () => {
    await rpc(connection, API.botWorkspaceSet, { botId: bot.id, workspace: draft.workspace || null });
    await rpc(connection, API.botModelSet, {
      botId: bot.id,
      model: draft.provider && draft.model ? { provider: draft.provider, model: draft.model, ...draft.reasoningEffort ? { reasoningEffort: draft.reasoningEffort } : {} } : null
    });
    await rpc(connection, API.botPresetSet, { botId: bot.id, preset: draft.preset || null });
    await rpc(connection, API.botProcessDetailSet, { botId: bot.id, mode: draft.processDetail === "brief" ? "brief" : "detailed" });
    await rpc(connection, API.botPermissionSet, { botId: bot.id, permissionPreset: draft.permissionPreset || null });
  });
  const saveScope = (scope) => run(`s-${scope}`, async () => {
    await rpc(connection, API.botContextSet, {
      botId: bot.id,
      config: { group: draft.contextEnhancement.group, direct: draft.contextEnhancement.direct }
    });
    await rpc(connection, API.botBusyModeSet, { botId: bot.id, scope, mode: draft.busyMode[scope] });
    if (scope === "group") {
      await rpc(connection, API.botBotReplySet, { botId: bot.id, enabled: draft.respondBot === true });
      await rpc(connection, API.botTopicsSet, { botId: bot.id, enabled: draft.topics !== false });
      await rpc(connection, API.botEavesdropSet, { botId: bot.id, eavesdrop: draft.eavesdrop });
      await rpc(connection, API.botMentionsSet, { botId: bot.id, mentions: draft.mentions });
      await saveAccess();
    }
  });
  const saveButton = (key, task) => h3("button", {
    type: "button",
    className: "bxf-check",
    style: S.check,
    disabled: busy === key,
    title: t("\u4FDD\u5B58", "Save"),
    "aria-label": t("\u4FDD\u5B58", "Save"),
    onClick: task
  }, busy === key ? "\u2026" : "\u2713");
  const selectedModel = models.find((item) => item.provider === draft.provider && item.model === draft.model) ?? null;
  const title = bot.alias || bot.botName || t("\u98DE\u4E66\u673A\u5668\u4EBA", "Feishu bot");
  const scopeEditor = (scopeKey, label) => {
    const scope = draft.contextEnhancement[scopeKey] ?? emptyScope();
    const update = (patch) => setDraft((current) => ({
      ...current,
      contextEnhancement: { ...current.contextEnhancement, [scopeKey]: { ...scope, ...patch } }
    }));
    const fields = scopeKey === "group" ? CE_FIELDS : CE_FIELDS.filter((field) => field !== "conversationTitle");
    return h3(
      "div",
      { style: { borderTop: "1px dashed var(--dsw-alias-border-l1, #e5e7eb)", paddingTop: "8px" } },
      h3(FieldLabel, { label, hint: t("\u6CE8\u5165\u54EA\u4E9B\u6765\u6E90\u5B57\u6BB5\uFF1A\u53EA\u52FE\u9009\u6A21\u578B\u65E0\u6CD5\u81EA\u884C\u63A8\u65AD\u7684\u6D88\u606F\u5143\u4FE1\u606F\u3002", "Which source fields to inject.") }),
      h3(
        "div",
        { style: S.checkRow },
        fields.map((field) => h3(
          "label",
          { key: field, style: S.checkLabel },
          h3("input", {
            type: "checkbox",
            checked: (scope.fields ?? []).includes(field),
            onChange: (event) => {
              const next = new Set(scope.fields ?? []);
              if (event.target.checked) next.add(field);
              else next.delete(field);
              update({ fields: CE_FIELDS.filter((item) => next.has(item)) });
            }
          }),
          text(CE_LABELS[field])
        ))
      ),
      h3("textarea", {
        style: { ...S.area, marginTop: "6px" },
        value: scope.guidance ?? "",
        placeholder: t("\u589E\u5F3A\u63D0\u793A\u8BCD\uFF08\u53EF\u9009\uFF09", "Guidance (optional)"),
        onChange: (event) => update({ guidance: event.target.value })
      })
    );
  };
  const accent = BOT_COLORS[bot.color] ?? BOT_COLORS.blue;
  return h3(
    "article",
    {
      className: "bxf-card",
      style: {
        ...S.card,
        borderLeft: `3px solid ${accent.main}`,
        "--bxf-accent": accent.main,
        "--bxf-accent-soft": accent.soft,
        "--bxf-accent-ring": accent.ring,
        "--bxf-accent-edge": accent.edge
      }
    },
    h3(
      "div",
      {
        className: "bxf-head",
        style: S.cardHead,
        role: "button",
        tabIndex: 0,
        "aria-expanded": open,
        onClick: () => setOpen((value) => !value),
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }
      },
      h3(
        "div",
        { style: S.grow },
        h3(
          "div",
          { style: S.nameRow },
          h3("span", { style: S.name }, title),
          h3("button", {
            type: "button",
            className: "bxf-icon-btn",
            style: S.iconBtn,
            title: t("\u4FEE\u6539\u663E\u793A\u540D\u79F0", "Rename"),
            "aria-label": t("\u4FEE\u6539\u663E\u793A\u540D\u79F0", "Rename"),
            onClick: (event) => {
              event.stopPropagation();
              setAliasOpen(true);
            }
          }, h3(
            "svg",
            {
              width: 13,
              height: 13,
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: 2,
              strokeLinecap: "round",
              strokeLinejoin: "round",
              "aria-hidden": true
            },
            h3("path", { d: "M12 20h9" }),
            h3("path", { d: "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" })
          )),
          h3(StatusBadge, { state: bot.state })
        ),
        h3(
          "div",
          { style: S.idRow },
          h3("span", { style: { ...S.meta, marginTop: 0 } }, `${bot.appIdMasked ?? bot.appId ?? ""} \xB7 ${t("\u4F1A\u8BDD", "chats")} ${bot.boundChats ?? 0}`),
          h3(
            "div",
            { style: { display: "flex", gap: "6px", flex: "none" }, onClick: (event) => event.stopPropagation() },
            h3("button", {
              type: "button",
              className: "bxf-mini",
              disabled: busy === "test",
              onClick: () => {
                void run("test", () => rpc(connection, API.botTest, { botId: bot.id }));
              }
            }, t("\u6D4B\u8BD5", "Test")),
            h3("button", {
              type: "button",
              className: "bxf-mini",
              disabled: busy === "reconnect",
              onClick: () => {
                void run("reconnect", () => rpc(connection, API.botReconnect, { botId: bot.id }));
              }
            }, t("\u91CD\u8FDE", "Reconnect")),
            h3("button", {
              type: "button",
              className: "bxf-mini",
              onClick: () => setDetailsOpen(true)
            }, t("\u8BE6\u60C5", "Details")),
            h3(UserIdentityButton, { connection, bot })
          )
        )
      )
    ),
    aliasOpen ? h3(AliasModal, { connection, bot, onClose: () => setAliasOpen(false), onSaved: onChanged }) : null,
    detailsOpen ? h3(DetailsModal, {
      bot,
      onClose: () => setDetailsOpen(false),
      onGrant: () => {
        setDetailsOpen(false);
        setGrantOpen(true);
      }
    }) : null,
    grantOpen ? h3(Boundary, null, h3(AddBotModal, {
      connection,
      mode: "scan",
      grant: bot,
      onClose: () => setGrantOpen(false),
      onAdded: onChanged
    })) : null,
    open && draft ? h3(
      "div",
      { style: S.body },
      h3(
        Panel,
        { title: t("\u901A\u7528", "General"), defaultOpen: true, action: isDirty("general") ? saveButton("g", saveGeneral) : null },
        h3(
          Field,
          { label: t("\u9ED8\u8BA4\u5DE5\u4F5C\u533A", "Default workspace"), hint: t("\u5217\u8868\u6765\u81EA DSH \u5DF2\u767B\u8BB0\u7684\u5DE5\u4F5C\u533A\u3002", "From the workspaces DSH already knows.") },
          h3(
            "select",
            {
              style: S.input,
              value: draft.workspaceMode,
              onChange: (event) => {
                const next = event.target.value;
                set({ workspaceMode: next, workspace: next === "__custom__" ? draft.workspaceCustom : next });
              }
            },
            h3("option", { value: "" }, t("\u8DDF\u968F DSH \u9ED8\u8BA4", "Host default")),
            workspaces.map((item) => h3("option", { key: item.path, value: item.path }, item.title && item.title !== item.path ? `${item.title} \u2014 ${item.path}` : item.path)),
            h3("option", { value: "__custom__" }, t("\u81EA\u5B9A\u4E49\u8DEF\u5F84\u2026", "Custom path\u2026"))
          )
        ),
        draft.workspaceMode === "__custom__" ? h3("input", {
          style: S.input,
          value: draft.workspaceCustom,
          placeholder: "/Users/you/work",
          onChange: (event) => set({ workspaceCustom: event.target.value, workspace: event.target.value })
        }) : null,
        h3(
          Field,
          { label: t("\u9ED8\u8BA4\u6A21\u578B\uFF08\u53EA\u5F71\u54CD\u65B0\u4F1A\u8BDD\uFF09", "Default model (new Sessions)") },
          h3(
            "select",
            {
              style: S.input,
              value: draft.provider && draft.model ? `${draft.provider}/${draft.model}` : "",
              onChange: (event) => {
                const [provider, ...rest] = event.target.value.split("/");
                set({ provider, model: rest.join("/"), reasoningEffort: "" });
              }
            },
            h3("option", { value: "" }, t("\u8DDF\u968F Host \u9ED8\u8BA4", "Host default")),
            models.map((item) => h3("option", { key: `${item.provider}/${item.model}`, value: `${item.provider}/${item.model}` }, item.label))
          )
        ),
        h3(
          Field,
          { label: t("\u601D\u8003\u5F3A\u5EA6", "Reasoning effort") },
          h3(
            "select",
            {
              style: S.input,
              value: draft.reasoningEffort,
              disabled: !selectedModel,
              onChange: (event) => set({ reasoningEffort: event.target.value })
            },
            h3("option", { value: "" }, t("\u8DDF\u968F\u6A21\u578B\u9ED8\u8BA4", "Model default")),
            (selectedModel?.reasoning?.efforts ?? []).map((effort) => h3("option", { key: effort.id, value: effort.id }, effort.name ?? effort.id))
          )
        ),
        h3(
          Field,
          { label: t("\u8FC7\u7A0B\u8BE6\u7EC6\u5EA6", "Progress detail"), hint: t("\u8BE6\u7EC6\uFF1A\u663E\u793A\u6BCF\u4E2A\u5DE5\u5177\u7684\u540D\u79F0\u4E0E\u53C2\u6570\uFF1B\u7B80\u8981\uFF1A\u53EA\u663E\u793A\u5DE5\u5177\u540D\u4E0E\u6C47\u603B\u3002", "Detailed shows tool arguments; brief keeps names and the summary.") },
          h3(
            "select",
            {
              style: S.input,
              value: draft.processDetail,
              onChange: (event) => set({ processDetail: event.target.value })
            },
            h3("option", { value: "detailed" }, t("\u8BE6\u7EC6", "Detailed")),
            h3("option", { value: "brief" }, t("\u7B80\u8981", "Brief"))
          )
        ),
        h3(
          Field,
          { label: t("\u65B0\u4F1A\u8BDD\u6743\u9650\u6863\u4F4D", "New-session permission"), hint: t("\u53EA\u5F71\u54CD\u4E4B\u540E\u65B0\u5EFA\u7684\u4F1A\u8BDD\uFF0C\u5DF2\u6709\u4F1A\u8BDD\u4E0D\u53D8\u3002", "Applies only to Sessions created later.") },
          h3(
            "select",
            {
              style: S.input,
              value: draft.permissionPreset,
              onChange: (event) => set({ permissionPreset: event.target.value })
            },
            h3("option", { value: "" }, t("\u8DDF\u968F Host \u9ED8\u8BA4", "Host default")),
            draft.permissionPreset && !(permissionOptions ?? []).some((item) => item.value === draft.permissionPreset) ? h3("option", { value: draft.permissionPreset }, `${draft.permissionPreset}${t("\uFF08\u5F53\u524D\uFF09", " (current)")}`) : null,
            (permissionOptions ?? []).map((item) => h3("option", { key: item.value, value: item.value }, item.name ?? item.value))
          )
        ),
        h3(
          Field,
          { label: t("\u9ED8\u8BA4 Agent \u9884\u8BBE\uFF08\u53EA\u5F71\u54CD\u65B0\u4F1A\u8BDD\uFF09", "Default agent preset (new Sessions)") },
          h3(
            "select",
            { style: S.input, value: draft.preset, onChange: (event) => set({ preset: event.target.value }) },
            h3("option", { value: "" }, t("\u8DDF\u968F Host \u9ED8\u8BA4\u9884\u8BBE", "Host default preset")),
            presets.map((item) => h3("option", { key: item.id, value: item.id }, item.name ?? item.id))
          )
        )
      ),
      h3(
        Panel,
        { title: t("\u79C1\u804A", "Private chat"), action: isDirty("direct") ? saveButton("s-direct", () => saveScope("direct")) : null },
        h3(
          Field,
          { label: t("\u8FD0\u884C\u4E2D\u6536\u5230\u666E\u901A\u6D88\u606F", "While a turn runs") },
          h3(
            "select",
            { style: S.input, value: draft.busyMode.direct, onChange: (event) => setDraft((current) => ({ ...current, busyMode: { ...current.busyMode, direct: event.target.value } })) },
            h3("option", { value: "queue" }, t("\u6392\u961F\u7B49\u5F85", "Queue")),
            h3("option", { value: "steer" }, t("\u63D2\u5165\u4E3A\u8865\u5145\u6307\u4EE4", "Steer"))
          )
        ),
        scopeEditor("direct", t("\u79C1\u804A\u4E0A\u4E0B\u6587\u6CE8\u5165", "Private-chat context"))
      ),
      h3(
        Panel,
        { title: t("\u7FA4\u804A", "Group chat"), action: isDirty("group") ? saveButton("s-group", () => saveScope("group")) : null },
        h3(
          Field,
          { label: t("\u8FD0\u884C\u4E2D\u6536\u5230\u666E\u901A\u6D88\u606F", "While a turn runs") },
          h3(
            "select",
            { style: S.input, value: draft.busyMode.group, onChange: (event) => setDraft((current) => ({ ...current, busyMode: { ...current.busyMode, group: event.target.value } })) },
            h3("option", { value: "queue" }, t("\u6392\u961F\u7B49\u5F85", "Queue")),
            h3("option", { value: "steer" }, t("\u63D2\u5165\u4E3A\u8865\u5145\u6307\u4EE4", "Steer"))
          )
        ),
        h3(
          Field,
          { label: t("\u542F\u7528\u8BDD\u9898", "Enable topics"), hint: t("\u5F00\u542F\u540E\u6240\u6709\u7FA4\u6210\u5458\u90FD\u80FD\u7528 /topic \u5F00\u8BDD\u9898\u3001/topic-sync \u540C\u6B65\u7ED3\u8BBA\uFF0C\u4E0D\u53D7\u7BA1\u7406\u767D\u540D\u5355\u9650\u5236\u3002", "Anyone in the group may open or sync topics; the manager list does not apply.") },
          h3(
            "label",
            { style: S.checkLabel },
            h3("input", {
              type: "checkbox",
              checked: draft.topics !== false,
              onChange: (event) => set({ topics: event.target.checked })
            }),
            t("\u5141\u8BB8", "Allow")
          )
        ),
        h3(
          Field,
          { label: t("\u54CD\u5E94\u5176\u5B83\u673A\u5668\u4EBA\u7684\u6D88\u606F", "Reply to other bots"), hint: t("\u5F00\u542F\u540E\uFF0C\u5176\u5B83\u673A\u5668\u4EBA\uFF08\u5E94\u7528\uFF09\u5728\u7FA4\u91CC\u7684\u53D1\u8A00\u4E5F\u4F1A\u89E6\u53D1\u672C\u673A\u5668\u4EBA\u3002", "When on, messages from other bots also trigger this bot.") },
          h3(
            "label",
            { style: S.checkLabel },
            h3("input", {
              type: "checkbox",
              checked: draft.respondBot === true,
              onChange: (event) => set({ respondBot: event.target.checked })
            }),
            t("\u5141\u8BB8", "Allow")
          )
        ),
        h3(
          Field,
          { label: t("\u65C1\u542C\u7FA4\u6D88\u606F\uFF08\u9ED8\u8BA4\u5F00\u542F\uFF09", "Eavesdrop group messages (on by default)"), hint: t("\u53EA\u628A\u6CA1\u6709 at \u4F60\u7684\u6D88\u606F\u8BB0\u4E3A\u4E0A\u4E0B\u6587\uFF0C\u4E0D\u4F1A\u89E6\u53D1\u56DE\u590D\uFF1B\u56FE\u7247/\u6587\u4EF6\u53EA\u8BB0\u5360\u4F4D\u4FE1\u606F\uFF0C\u6A21\u578B\u9700\u8981\u65F6\u4F1A\u8BF7\u4F60 at \u5B83\u91CD\u53D1\u3002\u9700\u8981 im:message.group_msg \u6743\u9650\uFF1B\u53EF\u7528\u300C\u8865\u9F50\u6743\u9650\u300D\u626B\u7801\u6388\u6743\u3002", 'Only messages that do not mention the bot are kept as context; never triggers a reply; images/files become placeholders and the model asks you to mention it and resend them when needed. Requires im:message.group_msg; use "Grant permissions" to authorize.') },
          h3(
            "label",
            { style: S.checkLabel },
            h3("input", {
              type: "checkbox",
              checked: draft.eavesdrop.enabled,
              onChange: (event) => set({ eavesdrop: { ...draft.eavesdrop, enabled: event.target.checked } })
            }),
            t("\u5141\u8BB8", "Allow")
          )
        ),
        draft.eavesdrop.enabled ? h3(
          Field,
          { label: t("\u6EDA\u52A8\u4FDD\u7559\u6761\u6570", "Rolling buffer size"), hint: t("\u9ED8\u8BA4\u4FDD\u7559\u6700\u8FD1 20 \u6761\uFF1B\u8D85\u8FC7\u540E\u4E22\u5F03\u6700\u65E7\u7684\u65C1\u542C\u6D88\u606F\uFF0C\u6700\u591A 500 \u6761\u3002", "Keeps the latest 20 messages by default; older messages are dropped past this limit, up to 500.") },
          h3("input", {
            type: "number",
            min: 1,
            max: 500,
            style: S.input,
            value: draft.eavesdrop.limit,
            onChange: (event) => set({
              eavesdrop: {
                ...draft.eavesdrop,
                limit: Math.min(500, Math.max(1, Number.parseInt(event.target.value, 10) || 20))
              }
            })
          })
        ) : null,
        h3(
          Field,
          { label: t("\u5141\u8BB8\u673A\u5668\u4EBA at \u4EBA\uFF08\u9ED8\u8BA4\u5F00\u542F\uFF09", "Let the bot mention people (on by default)"), hint: t("\u6D89\u53CA\u9700\u8981\u67D0\u4EBA\u51B3\u7B56\u3001\u6279\u51C6\u3001\u786E\u8BA4\u6216\u9009\u62E9\u65F6\uFF0C\u4E00\u5F8B\u7528 at \u63D0\u53CA\u5F53\u4E8B\u4EBA\uFF1B\u7EAF\u4FE1\u606F\u540C\u6B65\u3001\u72B6\u6001\u6C47\u62A5\u548C\u95F2\u804A\u4E0D\u8981 at\uFF1B\u4E0D\u786E\u5B9A\u5177\u4F53\u5F53\u4E8B\u4EBA\u65F6\u4E5F\u4E0D\u8981 at\u3002\u63D2\u4EF6\u4F1A\u6821\u9A8C open_id\uFF0C\u975E\u6CD5\u6216\u672A\u5F00\u542F\u65F6\u64E6\u9664\u3002", "When someone must decide, approve, confirm, or choose, always mention that person; do not mention for plain information sync, status updates, or chat, and do not guess when the person is unclear. The plugin validates open_ids and erases invalid or disabled mentions.") },
          h3(
            "label",
            { style: S.checkLabel },
            h3("input", {
              type: "checkbox",
              checked: draft.mentions.enabled,
              onChange: (event) => set({ mentions: { ...draft.mentions, enabled: event.target.checked } })
            }),
            t("\u5141\u8BB8", "Allow")
          )
        ),
        draft.mentions.enabled ? h3(
          Field,
          { label: t("\u7981\u6B62 @\u6240\u6709\u4EBA\uFF08\u9ED8\u8BA4\u5F00\u542F\uFF09", "Forbid @all (on by default)"), hint: t("\u5173\u95ED\u540E\u6A21\u578B\u53EF\u4EE5 @\u6240\u6709\u4EBA\uFF1B\u63D2\u4EF6\u4ECD\u4F1A\u6821\u9A8C open_id\u3002", "When off, the model may mention everyone; open_ids are still validated.") },
          h3(
            "label",
            { style: S.checkLabel },
            h3("input", {
              type: "checkbox",
              checked: draft.mentions.allowAll !== true,
              onChange: (event) => set({ mentions: { ...draft.mentions, allowAll: !event.target.checked } })
            }),
            t("\u7981\u6B62", "Forbid")
          )
        ) : null,
        h3(
          Field,
          { label: t("\u8C01\u80FD\u4F7F\u7528\u7FA4\u804A\u4E2D\u7684\u673A\u5668\u4EBA", "Who may use the bot in groups") },
          h3(
            "select",
            { style: S.input, value: draft.group, onChange: (event) => set({ group: event.target.value }) },
            h3("option", { value: "all" }, t("\u6240\u6709\u7528\u6237", "Everyone")),
            h3("option", { value: "allowlist" }, t("\u4EC5\u767D\u540D\u5355", "Allowlist"))
          )
        ),
        draft.group === "allowlist" ? h3(
          Field,
          { label: t("\u7FA4\u804A\u767D\u540D\u5355 Open ID", "Group allowlist Open IDs") },
          h3("textarea", { style: S.area, value: draft.allow, onChange: (event) => set({ allow: event.target.value }) })
        ) : null,
        h3(
          Field,
          { label: t("\u7BA1\u7406\u767D\u540D\u5355 Open ID\uFF08\u53EF\u6267\u884C /new\u3001\u505C\u6B62\u3001\u8C03\u6574\u4E0E\u5BA1\u6279\uFF09", "Manager allowlist (may run /new, stop, adjust and approve)"), hint: t("\u7559\u7A7A\u8868\u793A\u6CA1\u6709\u4EBA\u53EF\u4EE5\u5728\u7FA4\u91CC\u6267\u884C\u7BA1\u7406\u64CD\u4F5C\u3002", "Empty means nobody may manage in groups.") },
          h3("textarea", { style: S.area, value: draft.managers, onChange: (event) => set({ managers: event.target.value }) })
        ),
        scopeEditor("group", t("\u7FA4\u804A\u4E0A\u4E0B\u6587\u6CE8\u5165", "Group-chat context"))
      ),
      h3(
        Panel,
        { title: t("\u79FB\u9664", "Remove") },
        h3(
          "div",
          { style: { display: "flex", justifyContent: "center" } },
          h3("button", {
            type: "button",
            className: "bxf-danger",
            style: S.dangerBtn,
            disabled: busy === "remove",
            onClick: () => {
              if (!window.confirm(t(`\u79FB\u9664\u300C${title}\u300D\uFF1F\u672C\u673A\u5C06\u5220\u9664\u8BE5\u673A\u5668\u4EBA\u7684\u914D\u7F6E\u4E0E\u5BC6\u94A5\uFF0C\u4E0D\u5F71\u54CD\u98DE\u4E66\u5E94\u7528\u672C\u8EAB\u3002`, `Remove ${title}? Local config and secret are deleted; the Feishu app stays.`))) return;
              void run("remove", () => rpc(connection, API.botRemove, { botId: bot.id }));
            }
          }, t("\u79FB\u9664\u6B64\u673A\u5668\u4EBA", "Remove this bot"))
        )
      ),
      error ? h3("div", { style: { ...S.error, marginTop: "8px" } }, error) : null,
      notice ? h3("div", { className: "bxf-toast", style: S.toast }, notice) : null
    ) : null
  );
}

// client/settings.js
var h4 = import_react4.default.createElement;
function SettingsPage({ connection }) {
  const [state, setState] = import_react4.default.useState({ bots: [], version: null });
  const [models, setModels] = import_react4.default.useState([]);
  const [presets, setPresets] = import_react4.default.useState([]);
  const [workspaces, setWorkspaces] = import_react4.default.useState([]);
  const [permissionOptions, setPermissionOptions] = import_react4.default.useState([]);
  const [addMode, setAddMode] = import_react4.default.useState(null);
  const [error, setError] = import_react4.default.useState(null);
  const [loaded, setLoaded] = import_react4.default.useState(false);
  const refresh = import_react4.default.useCallback(async () => {
    try {
      const value = await rpc(connection, API.botsList, {});
      setState((previous) => {
        const nextBots = value.bots ?? [];
        const same = previous.version === (value.version ?? null) && JSON.stringify(previous.bots) === JSON.stringify(nextBots);
        return same ? previous : { bots: nextBots, version: value.version ?? null };
      });
      setError(null);
      setLoaded(true);
      return value;
    } catch (cause) {
      setError(cause.message);
      setLoaded(true);
      return null;
    }
  }, [connection]);
  import_react4.default.useEffect(() => {
    const POLL_MS = 3e4;
    let timer = null;
    const tick = () => {
      if (!document.hidden) void refresh();
    };
    const start = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(tick, POLL_MS);
    };
    const onVisibility = () => {
      if (document.hidden) {
        if (timer) clearInterval(timer);
        timer = null;
      } else {
        void refresh();
        start();
      }
    };
    void refresh();
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);
  import_react4.default.useEffect(() => {
    if (!loaded || state.bots.length === 0) return;
    let alive = true;
    const botId = state.bots[0].id;
    void rpc(connection, API.modelsList, {}).then((catalog) => {
      if (!alive) return;
      const flat = [];
      for (const group of catalog.groups ?? []) {
        for (const model of group.models ?? []) {
          flat.push({ provider: group.id, model: model.id, label: `${group.name} \xB7 ${model.name}`, reasoning: model.reasoning ?? null });
        }
      }
      setModels(flat);
    }).catch(() => void 0);
    void rpc(connection, API.presetsList, { botId }).then((value) => {
      if (alive) setPresets(Array.isArray(value?.presets) ? value.presets : []);
    }).catch(() => void 0);
    void rpc(connection, API.workspacesList, {}).then((value) => {
      if (alive) setWorkspaces(Array.isArray(value?.workspaces) ? value.workspaces : []);
    }).catch(() => void 0);
    void rpc(connection, API.permissionList, {}).then((value) => {
      if (alive) setPermissionOptions(Array.isArray(value?.options) ? value.options : []);
    }).catch(() => void 0);
    return () => {
      alive = false;
    };
  }, [connection, loaded, state.bots.length]);
  if (!loaded) {
    return h4(
      "div",
      { style: S.page },
      h4("h2", { style: S.title }, t("\u98DE\u4E66\u673A\u5668\u4EBA", "Feishu bots")),
      error ? h4(
        "div",
        null,
        h4("p", { style: S.error }, `${t("\u8BFB\u53D6\u5931\u8D25\uFF1A", "Failed: ")}${error}`),
        h4("button", { type: "button", style: S.btn("primary"), onClick: () => {
          setError(null);
          void refresh();
        } }, t("\u91CD\u8BD5", "Retry"))
      ) : h4("p", { style: S.sub }, t("\u6B63\u5728\u8BFB\u53D6\u2026", "Loading\u2026"))
    );
  }
  return h4(
    "div",
    { className: "bxf-page", style: S.page },
    h4("style", null, CSS),
    h4(
      "div",
      { style: S.head },
      h4(
        "div",
        null,
        h4("h2", { style: S.title }, t("\u98DE\u4E66\u673A\u5668\u4EBA", "Feishu bots")),
        h4("p", { style: S.sub }, state.version ? `v${state.version}` : "")
      ),
      h4(
        "div",
        { style: { display: "flex", gap: "8px", alignItems: "center" } },
        h4("button", { type: "button", style: S.btn(), onClick: () => setAddMode("manual") }, t("\u624B\u52A8\u6DFB\u52A0", "Add manually")),
        h4("button", { type: "button", style: S.btn("primary"), onClick: () => setAddMode("scan") }, t("\u626B\u7801\u6DFB\u52A0", "Add by scanning"))
      )
    ),
    error ? h4("div", { style: { ...S.error, marginBottom: "8px" } }, error) : null,
    state.bots.length === 0 ? h4(
      "div",
      { style: { ...S.card, padding: "18px" } },
      h4("p", { style: { margin: 0, fontSize: "13px" } }, t("\u8FD8\u6CA1\u6709\u673A\u5668\u4EBA\u3002\u70B9\u51FB\u53F3\u4E0A\u89D2\u300C\u6DFB\u52A0\u673A\u5668\u4EBA\u300D\uFF0C\u586B\u5165\u98DE\u4E66\u5E94\u7528\u7684 App ID / App Secret\u3002", "No bots yet. Use \u201CAdd bot\u201D and paste the app credentials."))
    ) : state.bots.map((bot) => h4(BotCard, {
      key: bot.id,
      connection,
      bot,
      models,
      presets,
      workspaces,
      permissionOptions,
      onChanged: () => {
        void refresh();
      }
    })),
    addMode ? h4(Boundary, null, h4(AddBotModal, {
      connection,
      mode: addMode,
      onClose: () => setAddMode(null),
      onAdded: () => {
        void refresh();
      }
    })) : null
  );
}

// client/index.js
var h5 = import_react5.default.createElement;
function BoundPage({ connection, locale, ...props }) {
  import_react5.default.useSyncExternalStore(
    (callback) => locale.subscribe(callback),
    () => locale.getLocale().revision,
    () => 0
  );
  return h5(SettingsPage, { ...props, connection });
}
function createPlugin() {
  return {
    inject: ["slots", "connection", "locale"],
    apply(ctx) {
      const connection = ctx.connection;
      if (!connection || typeof connection.rpc?.call !== "function") {
        console.error("[im-feishu] client connection service is missing; the settings page cannot call the Host");
      }
      ctx.effect(() => ctx.locale.register(NS, dictionaries()), "im-feishu: locale");
      ctx.effect(() => configureLocale(ctx.locale), "im-feishu: locale subscription");
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "im-feishu",
        order: 22,
        locale: NS,
        label: () => ctx.locale.bind(NS)("\u98DE\u4E66\u673A\u5668\u4EBA")
      }, (props) => h5(BoundPage, { ...props, connection, locale: ctx.locale })));
    }
  };
}

    })(module, module.exports, require);
    return module.exports.createPlugin();
  },
});
