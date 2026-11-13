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
var import_react6 = __toESM(require("react"), 1);

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
  "\u590D\u5236\u8BE6\u60C5": "Copy details",
  "\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5": "Copy failed. Please retry.",
  "\u5E94\u7528\u4FE1\u606F": "Application",
  "\u4F1A\u8BDD\u9ED8\u8BA4\u8BBE\u7F6E": "Session defaults",
  "\u5E94\u7528\u6743\u9650": "App permissions",
  "\u68C0\u67E5\u8FDE\u63A5": "Check connection",
  "\u6821\u9A8C\u51ED\u8BC1\u4E0E\u957F\u8FDE\u63A5\u72B6\u6001\uFF0C\u4E0D\u53D1\u9001\u6D88\u606F": "Verify credentials and connection status without sending messages",
  "\u51ED\u8BC1\u6709\u6548\uFF0C\u957F\u8FDE\u63A5\u6B63\u5E38": "Credentials verified; connection is active",
  "\u51ED\u8BC1\u6709\u6548\uFF0C\u957F\u8FDE\u63A5\u672A\u5C31\u7EEA\uFF0C\u53EF\u70B9\u51FB\u91CD\u8FDE": "Credentials verified; connection is not ready. Reconnect to retry.",
  "\u64CD\u4F5C\u5B8C\u6210": "Done",
  "\u8865\u9F50\u6743\u9650": "Grant permissions",
  "\u5DF2\u590D\u5236": "Copied",
  "\u590D\u5236": "Copy",
  "\u5173\u95ED": "Close",
  "\u5DF2\u4FDD\u5B58": "Saved",
  "\u7B49\u5F85\u4FDD\u5B58\u2026": "Waiting to save\u2026",
  "\u4FDD\u5B58\u5931\u8D25\uFF1A": "Save failed: ",
  "\u98DE\u4E66\u673A\u5668\u4EBA": "Feishu bots",
  "\u6CE8\u5165\u54EA\u4E9B\u6765\u6E90\u5B57\u6BB5\uFF1A\u53EA\u52FE\u9009\u6A21\u578B\u65E0\u6CD5\u81EA\u884C\u63A8\u65AD\u7684\u6D88\u606F\u5143\u4FE1\u606F\u3002": "Which source fields to inject.",
  "\u589E\u5F3A\u63D0\u793A\u8BCD\uFF08\u53EF\u9009\uFF09": "Guidance (optional)",
  "\u4FEE\u6539\u663E\u793A\u540D\u79F0": "Rename",
  "\u4F1A\u8BDD": "chats",
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
  "\u7B49\u5F85\u626B\u7801": "Awaiting scan",
  "\u6388\u6743\u4E0D\u5B8C\u6574": "Incomplete authorization",
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
  "\u6B63\u5728\u8BFB\u53D6\u76D1\u542C\u72B6\u6001\u2026": "Loading monitor status\u2026",
  "\u76D1\u542C\u4E2D": "Watching",
  "\u5DF2\u6682\u505C": "Paused",
  "\u6700\u540E\u68C0\u67E5": "Last check",
  "\u7ACB\u5373\u68C0\u67E5": "Check now",
  "\u9009\u62E9\u4F1A\u8BDD": "Choose chats",
  "\u6DFB\u52A0": "Add",
  "\u5168\u90E8\u6D88\u606F": "All messages",
  "\u5173\u952E\u8BCD": "Keywords",
  "\u89E6\u53D1\u89C4\u5219": "Trigger",
  "\u4EC5 @ \u4E0E\u56DE\u590D": "Mentions & replies",
  "\u56DE\u590D\u5BF9\u8C61": "Reply to",
  "\u4EC5\u771F\u4EBA": "People only",
  "\u5305\u542B\u673A\u5668\u4EBA": "People & bots",
  "\u5339\u914D\u5173\u952E\u8BCD": "Match keywords",
  "\u5173\u952E\u8BCD\uFF0C\u9017\u53F7\u5206\u9694": "Keywords, comma separated",
  "\u641C\u7D22\u4F1A\u8BDD": "Search chats",
  "\u641C\u7D22\u4F1A\u8BDD\u540D\u79F0\u6216 ID": "Search chat name or ID",
  "\u6B63\u5728\u8BFB\u53D6\u4F1A\u8BDD\u5217\u8868\u2026": "Loading chats\u2026",
  "\u6CA1\u6709\u627E\u5230\u5339\u914D\u7684\u4F1A\u8BDD\uFF0C\u8BD5\u8BD5\u5176\u4ED6\u5173\u952E\u8BCD\u3002": "No matching chats. Try another keyword.",
  "\u6240\u6709\u53EF\u7528\u4F1A\u8BDD\u90FD\u5DF2\u6DFB\u52A0\u3002": "All available chats have been added.",
  "\u5DF2\u6DFB\u52A0": "Added",
  "\u6DFB\u52A0\u4E2D\u2026": "Adding\u2026",
  "\u5DF2\u9009\u4F1A\u8BDD": "Selected chats",
  "\u6700\u8FD1\u68C0\u67E5": "Last checked",
  "\u5C1A\u672A\u68C0\u67E5": "Not checked yet",
  "\u68C0\u67E5\u4E2D\u2026": "Checking\u2026",
  "\u6536\u8D77\u5217\u8868": "Hide list",
  "\u6DFB\u52A0\u4F1A\u8BDD": "Add chat",
  "\u6DFB\u52A0\u9700\u8981\u81EA\u52A8\u56DE\u590D\u7684\u4F1A\u8BDD\uFF0C\u7136\u540E\u8BBE\u7F6E\u89E6\u53D1\u89C4\u5219\u3002": "Add a chat to reply to, then choose a trigger.",
  "\u6761\u6D88\u606F\u5F85\u5904\u7406": "messages pending",
  "\u6D3E\u53D1\u4E2D\u2026": "Dispatching\u2026",
  "\u91CD\u8BD5\u6D3E\u53D1": "Retry dispatch",
  "\u81EA\u52A8\u56DE\u590D\u8BBE\u7F6E": "Auto-reply settings",
  "\u8F6C\u4EBA\u5DE5\u3001\u5904\u7406\u4F1A\u8BDD\u4E0E\u56DE\u590D\u89C4\u5219": "Handoff, reply session and reply rules",
  "\u8F6C\u4EBA\u5DE5\u5173\u952E\u8BCD": "Handoff keywords",
  "\u8F6C\u4EBA\u5DE5\uFF0C\u4EBA\u5DE5\u5BA2\u670D": "human, agent",
  "\u7528\u9017\u53F7\u5206\u9694\u3002\u547D\u4E2D\u65F6\u8DF3\u8FC7\u5F53\u524D\u56DE\u590D\uFF0C\u4EA4\u7531\u4EBA\u5DE5\u5904\u7406\u3002": "Separate with commas. Matching messages are left for a person.",
  "\u5904\u7406\u4F1A\u8BDD": "Reply session",
  "\u5206\u7EC4": "Group",
  "\uFF08\u9ED8\u8BA4\uFF09": " (default)",
  "\u9884\u8BBE": "Preset",
  "\u9ED8\u8BA4": "Default",
  "\u5206\u8EAB\u56DE\u590D\u89C4\u5219": "Avatar reply rules",
  "\u6062\u590D\u9ED8\u8BA4\u6A21\u677F": "Restore default template",
  "\u66F4\u6539\u540E\uFF0C\u5C06\u5728\u4E0B\u6B21\u81EA\u52A8\u56DE\u590D\u65F6\u521B\u5EFA\u65B0\u4F1A\u8BDD\u3002": "Changes create a new session on the next automatic reply.",
  "\u51ED\u8BC1\u5DF2\u5237\u65B0": "Credentials refreshed",
  "\u8BFB\u53D6\u72B6\u6001\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002": "Unable to load status. Please retry.",
  "\u626B\u7801\u8FDE\u63A5\u98DE\u4E66": "Scan to connect Feishu",
  "\u98DE\u4E66\u6388\u6743\u4E8C\u7EF4\u7801": "Feishu authorization QR code",
  "\u98DE\u4E66\u8D26\u53F7": "Feishu account",
  "\u8BBF\u95EE\u51ED\u8BC1\u5230\u671F": "Access token expires",
  "\u5237\u65B0\u51ED\u8BC1\u5230\u671F": "Refresh token expires",
  "\u6388\u6743\u5230\u671F": "Authorization expires",
  "\u6388\u6743\u5230\u671F\u65F6\u95F4\u672A\u77E5": "Authorization expiry unavailable",
  "\u9700\u91CD\u65B0\u6388\u6743": "Re-authorization required",
  "\u5237\u65B0\u51ED\u8BC1\u5230\u671F\u540E\u9700\u91CD\u65B0\u6388\u6743\uFF1B\u6B64\u65F6\u95F4\u968F\u51ED\u8BC1\u5237\u65B0\u66F4\u65B0\u3002": "Re-authorize when the refresh token expires. This time updates when credentials are refreshed.",
  "\u5237\u65B0\u51ED\u8BC1": "Refresh credentials",
  "\u8FDE\u63A5\u98DE\u4E66\u8D26\u53F7\u540E\uFF0C\u5373\u53EF\u8BBE\u7F6E\u6D88\u606F\u76D1\u542C\u4E0E\u81EA\u52A8\u56DE\u590D\u3002": "Connect your Feishu account to set up monitoring and automatic replies.",
  "\u8BBE\u7F6E\u4FEE\u6539\u540E\u81EA\u52A8\u4FDD\u5B58": "Settings save automatically"
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

// src/contracts.js
var RPC_ENDPOINT = "im-feishu";
var ACCESS_MODES = Object.freeze({ ALL: "all", ALLOWLIST: "allowlist" });
var BUSY_MODES = Object.freeze({ QUEUE: "queue", STEER: "steer" });
var BOT_COLORS = Object.freeze(["blue", "green", "purple", "orange", "pink", "red"]);
var CONTEXT_ENHANCEMENT_FIELDS = Object.freeze([
  "senderId",
  "senderName",
  "botId",
  "sentAt",
  "conversationTitle"
]);
var API = Object.freeze({
  botAccessSet: "bot.access.set",
  botAdd: "bot.add",
  botAliasSet: "bot.alias.set",
  botBusyModeSet: "bot.busy-mode.set",
  botColorSet: "bot.color.set",
  botContextSet: "bot.context-enhancement.set",
  botEavesdropSet: "bot.eavesdrop.set",
  botMentionsSet: "bot.mentions.set",
  botBotReplySet: "bot.bot-reply.set",
  botProcessDetailSet: "bot.process-detail.set",
  botModelSet: "bot.model.set",
  botPresetSet: "bot.preset.set",
  botPermissionSet: "bot.permission.set",
  botReconnect: "bot.reconnect",
  botRemove: "bot.remove",
  botCheck: "bot.check",
  // Legacy clients use this name; the server now routes it to the same read-only check.
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
  userMonitorWorkerSet: "user.monitor.worker.set",
  userMonitorHandoffSet: "user.monitor.handoff.set",
  userMonitorReplyRulesSet: "user.monitor.reply-rules.set",
  userMonitorWorkerOptions: "user.monitor.worker.options",
  userMonitorPoll: "user.monitor.poll",
  userMonitorFlush: "user.monitor.flush",
  userMonitorChatSet: "user.monitor.chat.set"
});

// client/shared.js
var h = import_react.default.createElement;
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
var CE_FIELDS = CONTEXT_ENHANCEMENT_FIELDS;
var CE_LABELS = {
  senderId: ["\u53D1\u9001\u8005 Open ID", "Sender Open ID"],
  senderName: ["\u53D1\u9001\u8005\u540D\u79F0", "Sender name"],
  botId: ["\u673A\u5668\u4EBA Open ID", "Bot Open ID"],
  sentAt: ["\u53D1\u9001\u65F6\u95F4", "Sent at"],
  conversationTitle: ["\u7FA4\u540D\u79F0", "Group name"]
};
var BOT_COLORS2 = {
  blue: { main: "#3370ff", soft: "rgba(51,112,255,.10)", ring: "rgba(51,112,255,.32)", edge: "#93b4ff" },
  pink: { main: "#d94690", soft: "rgba(217,70,144,.10)", ring: "rgba(217,70,144,.30)", edge: "#eda3c9" },
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
  orange: ["\u6A59\u8272", "Orange"],
  pink: ["\u7C89\u8272", "Pink"]
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
.bxf-bot-settings { padding: 14px; display: grid; gap: 12px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
  background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.bxf-panel { min-width: 0; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1, #fff); }
.bxf-panel-head { display: flex; align-items: center; gap: 8px; padding: 0 14px; min-height: 48px; }
.bxf-panel-toggle { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; padding: 14px 0;
  border: 0; background: transparent; color: inherit; font: inherit; font-size: 13px; font-weight: 600; text-align: left; cursor: pointer; }
.bxf-panel-title { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.bxf-panel-toggle:hover { color: var(--bxf-accent, #3370ff); }
.bxf-panel-toggle:focus-visible { outline: 2px solid var(--bxf-accent, #3370ff); outline-offset: 3px; border-radius: 4px; }
.bxf-panel-chevron { flex: none; color: var(--dsw-alias-label-secondary, #6b7280); transition: transform .15s; }
.bxf-panel-toggle[aria-expanded="true"] .bxf-panel-chevron { transform: rotate(90deg); }
.bxf-panel-action { flex: none; }
.bxf-panel-content { border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); padding: 14px; container-type: inline-size; }
.bxf-panel-body { display: grid; gap: 16px; min-width: 0; }
.bxf-field { min-width: 0; }
.bxf-panel-body :is(input, select, textarea) { min-width: 0; font-family: inherit; }
.bxf-panel-body select { text-overflow: ellipsis; }
.bxf-panel-body textarea { resize: vertical; max-width: 100%; }
.bxf-general-fields { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.bxf-field-wide { grid-column: 1 / -1; }
.bxf-panel-danger .bxf-panel-title { color: var(--dsw-alias-state-error-primary, #dc2626); }
.bxf-bot-meta { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 12px; margin-top: 6px; }
.bxf-bot-meta > span { min-width: 0; overflow-wrap: anywhere; }
.bxf-bot-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
@container (max-width: 440px) {
  .bxf-general-fields { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) {
  .bxf-panel-chevron { transition: none; }
}
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
.bxf-save-status { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-width: 0;
  font-size: 11px; color: var(--dsw-alias-label-secondary); }
.bxf-save-status > span { min-width: 0; overflow-wrap: anywhere; }
.bxf-save-status[data-state="error"] { color: var(--dsw-alias-state-error-primary); }
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
function Field({ label, hint, children, fullWidth = false }) {
  return h(
    "div",
    { className: `bxf-field${fullWidth ? " bxf-field-wide" : ""}` },
    label ? h(FieldLabel, { label, hint }) : null,
    children
  );
}
function SaveStatus({ state, onRetry }) {
  if (state.status === "idle") return null;
  const label = state.status === "error" ? `${t("\u4FDD\u5B58\u5931\u8D25\uFF1A", "Save failed: ")}${state.error}` : state.status === "pending" ? t("\u7B49\u5F85\u4FDD\u5B58\u2026", "Waiting to save\u2026") : state.status === "saving" ? t("\u4FDD\u5B58\u4E2D\u2026", "Saving\u2026") : t("\u5DF2\u4FDD\u5B58", "Saved");
  return h(
    "div",
    { className: "bxf-save-status", "data-state": state.status, role: "status" },
    h("span", null, label),
    state.status === "error" ? h("button", { type: "button", className: "bxf-mini", onClick: onRetry }, t("\u91CD\u8BD5", "Retry")) : null
  );
}
function Panel({ title, action, children, defaultOpen = false, bodyClassName = "", danger = false }) {
  const [open, setOpen] = import_react.default.useState(defaultOpen);
  return h(
    "section",
    { className: `bxf-panel${danger ? " bxf-panel-danger" : ""}` },
    h(
      "div",
      { className: "bxf-panel-head" },
      h(
        "button",
        {
          type: "button",
          className: "bxf-panel-toggle",
          "aria-expanded": open,
          onClick: () => setOpen((value) => !value)
        },
        h("span", { className: "bxf-panel-title" }, title),
        h(
          "svg",
          { className: "bxf-panel-chevron", width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true },
          h("path", { d: "m9 5 7 7-7 7" })
        )
      ),
      action ? h("div", { className: "bxf-panel-action" }, action) : null
    ),
    h(
      "div",
      { className: "bxf-panel-content", hidden: !open },
      h("div", { className: `bxf-panel-body ${bodyClassName}`.trim() }, children)
    )
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
var import_react5 = __toESM(require("react"), 1);

// client/bot.js
var import_react4 = __toESM(require("react"), 1);

// client/identity.js
var import_react3 = __toESM(require("react"), 1);

// client/hooks.js
var import_react2 = __toESM(require("react"), 1);

// client/async.js
function startPolling(task, { interval, immediate = true, document = globalThis.document, onError = () => {
} }) {
  const controller = new AbortController();
  let timer;
  let running = false;
  const schedule = (delay) => {
    clearTimeout(timer);
    if (!controller.signal.aborted && !document?.hidden) timer = setTimeout(tick, delay);
  };
  const tick = async () => {
    if (running || controller.signal.aborted || document?.hidden) return;
    running = true;
    try {
      await task(controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) onError(error);
    } finally {
      running = false;
      schedule(interval);
    }
  };
  const onVisibility = () => {
    clearTimeout(timer);
    if (!document?.hidden) void tick();
  };
  document?.addEventListener("visibilitychange", onVisibility);
  if (immediate) void tick();
  else schedule(interval);
  return () => {
    controller.abort();
    clearTimeout(timer);
    document?.removeEventListener("visibilitychange", onVisibility);
  };
}
function createQuery(fetchValue, { onValue, onError }) {
  let active = true;
  let revision = 0;
  let flight = null;
  return {
    activate() {
      active = true;
    },
    dispose() {
      active = false;
      revision += 1;
      flight = null;
    },
    invalidate() {
      revision += 1;
      flight = null;
    },
    accept(value) {
      revision += 1;
      flight = null;
      if (active) onValue(value);
    },
    refresh() {
      if (!active) return Promise.resolve(null);
      if (flight) return flight;
      const current = revision;
      const request = Promise.resolve().then(fetchValue).then((value) => {
        if (active && revision === current) onValue(value);
        return value;
      }, (error) => {
        if (active && revision === current) onError(error);
        return null;
      }).finally(() => {
        if (flight === request) flight = null;
      });
      flight = request;
      return request;
    }
  };
}
function syncDraft(draft, serverValue) {
  return { baseline: serverValue, value: draft.value === draft.baseline ? serverValue : draft.value };
}
function commitDraft(draft, savedValue, submittedValue) {
  return { baseline: savedValue, value: draft.value === submittedValue ? savedValue : draft.value };
}
var remainingSeconds = (expiresAt, now = Date.now()) => Number.isFinite(expiresAt) ? Math.max(0, Math.ceil((expiresAt - now) / 1e3)) : 0;

// client/autosave.js
function createAutoSave() {
  const pending = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Set();
  let flight = null;
  let running = false;
  let saved = false;
  let composing = false;
  const snapshot = () => {
    const error = [...pending.values()].find((job) => job.error)?.error ?? null;
    return { status: error ? "error" : running ? "saving" : pending.size ? "pending" : saved ? "saved" : "idle", error };
  };
  const publish = () => {
    const value = snapshot();
    listeners.forEach((listener) => listener(value));
  };
  const pump = () => {
    if (flight) return flight;
    flight = Promise.resolve().then(async () => {
      for (; ; ) {
        const entry = [...pending].find(([, job2]) => job2.ready && !job2.error);
        if (!entry) break;
        const [key, job] = entry;
        pending.delete(key);
        running = true;
        publish();
        try {
          await job.work();
          saved = true;
        } catch (error) {
          if (!pending.has(key)) pending.set(key, { ...job, ready: false, error: error?.message ?? String(error) });
        }
        running = false;
        publish();
      }
    }).finally(() => {
      flight = null;
      publish();
    });
    return flight;
  };
  return {
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    schedule(key, work, delay = 0) {
      clearTimeout(pending.get(key)?.timer);
      const job = { work, delay, ready: delay === 0, error: null, timer: null };
      pending.set(key, job);
      if (delay > 0 && !composing) job.timer = setTimeout(() => {
        job.ready = true;
        void pump();
      }, delay);
      publish();
      if (job.ready) void pump();
    },
    cancel(key) {
      clearTimeout(pending.get(key)?.timer);
      pending.delete(key);
      publish();
    },
    pauseText() {
      composing = true;
      for (const job of pending.values()) if (job.delay > 0) {
        clearTimeout(job.timer);
        job.ready = false;
      }
    },
    resumeText() {
      composing = false;
      for (const job of pending.values()) if (job.delay > 0 && !job.error) {
        clearTimeout(job.timer);
        job.timer = setTimeout(() => {
          job.ready = true;
          void pump();
        }, job.delay);
      }
    },
    async flush(retry = false) {
      do {
        for (const job of pending.values()) {
          clearTimeout(job.timer);
          if (retry) job.error = null;
          if (!job.error) job.ready = true;
        }
        await pump();
        retry = false;
      } while ([...pending.values()].some((job) => !job.error));
      return pending.size === 0;
    }
  };
}

// client/hooks.js
function usePolling(task, { interval, enabled = true, immediate = true, scope = null }) {
  const current = import_react2.default.useRef(task);
  current.current = task;
  import_react2.default.useEffect(
    () => enabled ? startPolling((signal) => current.current(signal), { interval, immediate }) : void 0,
    [interval, enabled, immediate, scope]
  );
}
function useRpcQuery(connection, method, initialValue = null) {
  const [data, setData] = import_react2.default.useState(initialValue);
  const [error, setError] = import_react2.default.useState(null);
  const [loaded, setLoaded] = import_react2.default.useState(false);
  const query = import_react2.default.useMemo(() => createQuery(() => rpc(connection, method, {}), {
    onValue(value) {
      setData(value);
      setError(null);
      setLoaded(true);
    },
    onError(failure) {
      setError(failure?.message ?? String(failure));
      setLoaded(true);
    }
  }), [connection, method]);
  import_react2.default.useEffect(() => {
    query.activate();
    setData(initialValue);
    setError(null);
    setLoaded(false);
    return () => query.dispose();
  }, [query]);
  return { data, error, loaded, ...query };
}
function useDraft(serverValue) {
  const [draft, setDraft] = import_react2.default.useState(() => ({ baseline: serverValue, value: serverValue }));
  import_react2.default.useEffect(() => {
    setDraft((previous) => syncDraft(previous, serverValue));
  }, [serverValue]);
  return [
    draft.value,
    (value) => setDraft((previous) => ({ ...previous, value })),
    (saved, submitted) => setDraft((previous) => commitDraft(previous, saved, submitted))
  ];
}
function useAutoSave() {
  const [queue] = import_react2.default.useState(createAutoSave);
  const [state, setState] = import_react2.default.useState({ status: "idle", error: null });
  const alive = import_react2.default.useRef(false);
  import_react2.default.useEffect(() => {
    alive.current = true;
    const unsubscribe = queue.subscribe(setState);
    return () => {
      alive.current = false;
      unsubscribe();
      void queue.flush();
    };
  }, [queue]);
  return {
    state,
    flush: queue.flush,
    cancel: queue.cancel,
    retry: () => queue.flush(true),
    compositionHandlers: { onCompositionStartCapture: queue.pauseText, onCompositionEndCapture: queue.resumeText },
    schedule(key, operation, delay = 0, onSaved) {
      queue.schedule(key, async () => {
        const value = await operation();
        if (alive.current) onSaved?.(value);
      }, delay);
    }
  };
}
function useMutation() {
  const [busy, setBusy] = import_react2.default.useState("");
  const [error, setError] = import_react2.default.useState(null);
  const tail = import_react2.default.useRef(Promise.resolve());
  const alive = import_react2.default.useRef(true);
  import_react2.default.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const run = (label, operation, onSuccess = () => {
  }) => {
    const task = tail.current.then(async () => {
      if (!alive.current) return;
      setBusy(label);
      setError(null);
      try {
        const value = await operation();
        if (alive.current) await onSuccess(value);
        return value;
      } catch (failure) {
        if (alive.current) setError(failure?.message ?? String(failure));
      } finally {
        if (alive.current) setBusy("");
      }
    });
    tail.current = task;
    return task;
  };
  return { busy, error, run };
}

// client/identity-style.js
var IDENTITY_CSS = `
.bxf-identity-overlay { box-sizing: border-box; padding: 20px; }
.bxf-identity-dialog { width: min(740px, 100%); max-height: calc(100vh - 40px); max-height: calc(100dvh - 40px);
  display: flex; flex-direction: column; min-height: 0; overflow: hidden; container-type: inline-size;
  border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 16px;
  background: var(--dsw-alias-bg-layer-1, #fff); color: var(--dsw-alias-label-primary, #1c1c1e);
  box-shadow: 0 24px 64px rgba(15,23,42,.22); font-size: 13px; line-height: 1.5; }
.bxf-identity-dialog * { box-sizing: border-box; }
.bxf-identity-header { flex: none; display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 16px 22px; }
.bxf-identity-header { border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-identity-header h2 { margin: 0; font-size: 17px; font-weight: 650; }
.bxf-identity-hint { color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; }
.bxf-identity-hint { margin: 6px 0 0; line-height: 1.55; overflow-wrap: anywhere; }
.bxf-identity-body { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 18px 22px;
  display: flex; flex-direction: column; gap: 12px; scrollbar-gutter: stable;
  background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.bxf-identity-body > * { flex: none; min-width: 0; }
.bxf-identity-dialog button { font-family: inherit; flex-shrink: 0; white-space: nowrap; }
.bxf-identity-dialog button:disabled { opacity: .5; cursor: not-allowed; }
.bxf-identity-close { width: 30px; height: 30px; display: grid; place-items: center; padding: 0; flex: none;
  border: 0; border-radius: 7px; cursor: pointer; background: transparent; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 23px; }
.bxf-identity-close:hover { background: var(--dsw-alias-bg-layer-2, #f5f6f8); }
.bxf-identity-card { width: 100%; min-width: 0; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
  border-radius: 12px; background: var(--dsw-alias-bg-layer-1, #fff); }
.bxf-identity-card-head { display: flex; align-items: center; gap: 12px; padding: 16px; min-width: 0;
  cursor: pointer; list-style: none; border-radius: 12px; }
.bxf-identity-card-head::-webkit-details-marker { display: none; }
.bxf-identity-card-head::marker { content: ''; }
.bxf-identity-card-head:hover { background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.bxf-identity-card-icon { width: 36px; height: 36px; display: grid; place-items: center; flex: none;
  border-radius: 10px; background: var(--dsw-alias-bg-layer-2, #f7f8fa); color: var(--dsw-alias-label-secondary, #6b7280); }
.bxf-identity-card-heading { flex: 1; min-width: 0; }
.bxf-identity-card-title { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.bxf-identity-card-title strong { font-size: 14px; font-weight: 650; overflow-wrap: anywhere; }
.bxf-identity-card-description { display: block; margin-top: 3px; font-size: 12px; color: var(--dsw-alias-label-secondary, #6b7280);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bxf-identity-expiry { white-space: normal; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.bxf-identity-expiry-expired { color: var(--dsw-alias-state-error-primary, #dc2626); }
.bxf-identity-card-chevron { flex: none; color: var(--dsw-alias-label-secondary, #6b7280); transition: transform .15s; }
.bxf-identity-card[open] > .bxf-identity-card-head .bxf-identity-card-chevron { transform: rotate(90deg); }
.bxf-identity-card[open] > .bxf-identity-card-head { border-radius: 12px 12px 0 0; }
.bxf-identity-card-content { min-width: 0; padding: 16px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-identity-avatar { display: grid; place-items: center; width: 38px; height: 38px; flex: none; border-radius: 11px;
  background: rgba(16,185,129,.1); color: var(--dsw-alias-state-success-primary, #059669); font-size: 17px; font-weight: 600; }
.bxf-identity-facts { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px 14px; margin: 0 0 16px; font-size: 12px; }
.bxf-identity-alert + .bxf-identity-facts { margin-top: 16px; }
.bxf-identity-facts dt { color: var(--dsw-alias-label-secondary, #6b7280); }
.bxf-identity-facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.bxf-identity-actions, .bxf-identity-section-head, .bxf-identity-list-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.bxf-identity-actions { justify-content: flex-start; }
.bxf-identity-section-head { margin-bottom: 8px; }
.bxf-identity-section-head .bxf-identity-setting-title { margin: 0; }
.bxf-identity-list-head { margin-bottom: 14px; }
.bxf-identity-list-meta { color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; }
.bxf-identity-chat-list { display: grid; gap: 8px; }
.bxf-identity-chat { display: grid; grid-template-columns: minmax(0, 1fr) auto;
  align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 10px; }
.bxf-identity-chat-main { min-width: 0; grid-column: 1; grid-row: 1; }
.bxf-identity-chat-controls { grid-column: 1 / -1; grid-row: 2; display: grid; min-width: 0;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.bxf-identity-chat-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bxf-identity-chat-meta { margin-top: 3px; font-size: 11px; color: var(--dsw-alias-label-secondary, #6b7280); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bxf-identity-field { display: flex; flex-direction: column; min-width: 0; gap: 5px; }
.bxf-identity-field > span { font-size: 12px; color: var(--dsw-alias-label-secondary, #6b7280); }
.bxf-identity-dialog .bxf-identity-control { width: 100%; min-width: 0; font-family: inherit; text-overflow: ellipsis; }
.bxf-identity-remove { grid-column: 2; grid-row: 1; height: 30px; }
.bxf-identity-chat-extra { grid-column: 1 / -1; }
.bxf-identity-empty { padding: 20px 14px; text-align: center; border: 1px dashed var(--dsw-alias-border-l2, #d1d5db);
  border-radius: 10px; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; }
.bxf-identity-picker { margin-top: 10px; padding: 12px; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
  background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.bxf-identity-picker-list { max-height: 200px; overflow-y: auto; overscroll-behavior: contain; margin-top: 8px; }
.bxf-identity-candidate { display: flex; align-items: center; gap: 10px; padding: 8px 2px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-identity-candidate:last-child { border-bottom: 0; }
.bxf-identity-candidate-info { min-width: 0; flex: 1; }
.bxf-identity-candidate-info strong { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; font-weight: 500; }
.bxf-identity-settings { display: grid; gap: 20px; }
.bxf-identity-setting { min-width: 0; }
.bxf-identity-setting + .bxf-identity-setting { border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); padding-top: 20px; }
.bxf-identity-setting-title { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
.bxf-identity-field > .bxf-identity-setting-title { margin: 0; }
.bxf-identity-rules { display: block; width: 100%; max-width: 100%; margin-top: 12px; height: auto; max-height: 420px;
  resize: vertical; font-family: inherit; line-height: 1.7; overflow-wrap: anywhere; }
.bxf-identity-worker { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.bxf-identity-alert { font-size: 12px; padding: 9px 12px; border-radius: 8px; overflow-wrap: anywhere; background: rgba(239,68,68,.06); color: var(--dsw-alias-state-error-primary, #dc2626); }
.bxf-identity-notice { font-size: 12px; padding: 9px 12px; border-radius: 8px; background: rgba(16,185,129,.08); color: var(--dsw-alias-state-success-primary, #059669); }
.bxf-identity-connect { text-align: center; padding: 22px 12px; }
.bxf-identity-qr { display: inline-flex; padding: 12px; margin-top: 14px; border-radius: 12px; background: #fff; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); line-height: 0; }
.bxf-identity-dialog :is(button, summary, input, select, textarea):focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #3370ff); outline-offset: 2px; }
@container (max-width: 440px) {
  .bxf-identity-chat-controls, .bxf-identity-worker { grid-template-columns: minmax(0, 1fr); }
  .bxf-identity-card-head { padding: 14px; gap: 10px; }
  .bxf-identity-card-content { padding: 14px; }
  .bxf-identity-card-icon { width: 32px; height: 32px; }
  .bxf-identity-facts { grid-template-columns: minmax(0, 1fr); gap: 3px; }
  .bxf-identity-facts dd + dt { margin-top: 6px; }
}
@media (max-width: 480px) {
  .bxf-identity-overlay { padding: 10px !important; }
  .bxf-identity-dialog { max-height: calc(100vh - 20px); max-height: calc(100dvh - 20px); border-radius: 12px; }
  .bxf-identity-header { padding-left: 16px; padding-right: 16px; }
  .bxf-identity-body { padding: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .bxf-identity-card-chevron { transition: none; }
}
`;

// client/identity.js
var h2 = import_react3.default.createElement;
function IdentityCard({ title, description, descriptionClassName = "", descriptionTitle, badge, kind, avatar, defaultOpen = false, children }) {
  const [open, setOpen] = import_react3.default.useState(defaultOpen);
  const paths = {
    account: "M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    monitor: "M4 4h16v12H9l-5 4V4Zm4 4h8M8 12h5",
    reply: "M9 7H6a3 3 0 0 0-3 3v9l4-4h6a3 3 0 0 0 3-3v-1m1-9 1.5 4.5L23 8l-4.5 1.5L17 14l-1.5-4.5L11 8l4.5-1.5L17 2Z"
  };
  return h2(
    "details",
    {
      className: "bxf-identity-card",
      open,
      onToggle: (event) => {
        if (event.target === event.currentTarget) setOpen(event.currentTarget.open);
      }
    },
    h2(
      "summary",
      { className: "bxf-identity-card-head" },
      avatar ?? h2(
        "span",
        { className: "bxf-identity-card-icon", "aria-hidden": true },
        h2(
          "svg",
          { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" },
          h2("path", { d: paths[kind] })
        )
      ),
      h2(
        "span",
        { className: "bxf-identity-card-heading" },
        h2("span", { className: "bxf-identity-card-title" }, h2("strong", null, title), badge),
        description ? h2("span", { className: `bxf-identity-card-description ${descriptionClassName}`.trim(), title: descriptionTitle ?? description }, description) : null
      ),
      h2(
        "svg",
        { className: "bxf-identity-card-chevron", width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true },
        h2("path", { d: "m9 5 7 7-7 7" })
      )
    ),
    h2("div", { className: "bxf-identity-card-content" }, children)
  );
}
function MonitorPanel({ connection, saveRef }) {
  const { data: monitor, error: loadError, accept: setMonitor, refresh: load, invalidate } = useRpcQuery(connection, API.userMonitorStatus);
  const { busy, error: actionError, run } = useMutation();
  const error = actionError ?? loadError;
  const [handoffText, setHandoffText, commitHandoff] = useDraft((monitor?.handoffKeywords ?? []).join("\uFF0C"));
  const [replyRules, setReplyRules, commitReplyRules] = useDraft(monitor?.replyRules ?? "");
  const autoSave = useAutoSave();
  import_react3.default.useEffect(() => {
    saveRef.current = autoSave.flush;
    return () => {
      saveRef.current = null;
    };
  }, [saveRef, autoSave.flush]);
  usePolling(load, { interval: 1e4, scope: connection });
  const [available, setAvailable] = import_react3.default.useState(null);
  const [showPicker, setShowPicker] = import_react3.default.useState(false);
  const [chatFilter, setChatFilter] = import_react3.default.useState("");
  const [workerOptions, setWorkerOptions] = import_react3.default.useState({ workspaces: [], presets: [], defaultWorkspaceId: null });
  import_react3.default.useEffect(() => {
    let alive = true;
    void rpc(connection, API.userMonitorWorkerOptions, {}).then((value) => {
      if (!alive) return;
      setWorkerOptions({
        workspaces: Array.isArray(value?.workspaces) ? value.workspaces : [],
        presets: Array.isArray(value?.presets) ? value.presets : [],
        defaultWorkspaceId: typeof value?.defaultWorkspaceId === "string" ? value.defaultWorkspaceId : null
      });
    }).catch(() => void 0);
    return () => {
      alive = false;
    };
  }, [connection]);
  const act = (label, operation, onSaved) => run(label, () => {
    invalidate();
    return operation();
  }, (value) => {
    if (value) setMonitor(value);
    onSaved?.(value);
  });
  const add = (chat) => act(`add:${chat.chatId}`, () => rpc(connection, API.userMonitorAdd, chat));
  const remove = async (chat) => {
    autoSave.cancel(`keywords:${chat.chatId}`);
    await autoSave.flush();
    autoSave.cancel(`keywords:${chat.chatId}`);
    return act(`remove:${chat.chatId}`, () => rpc(connection, API.userMonitorRemove, { chatId: chat.chatId }));
  };
  const setChat = (chat, patch) => act(`mode:${chat.chatId}`, () => rpc(connection, API.userMonitorChatSet, { chatId: chat.chatId, ...patch }));
  const setWorker = (patch) => act("worker", () => rpc(connection, API.userMonitorWorkerSet, patch));
  const scheduleSetting = (key, method, payload, delay = 600, onSaved) => {
    autoSave.schedule(key, () => {
      invalidate();
      return rpc(connection, method, payload);
    }, delay, (value) => {
      setMonitor(value);
      onSaved?.(value);
    });
  };
  const updateHandoff = (text2) => {
    setHandoffText(text2);
    const keywords = text2.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
    scheduleSetting(
      "handoff",
      API.userMonitorHandoffSet,
      { keywords },
      600,
      (value) => commitHandoff((value.handoffKeywords ?? keywords).join("\uFF0C"), text2)
    );
  };
  const updateReplyRules = (text2, delay = 600) => {
    setReplyRules(text2);
    scheduleSetting(
      "reply-rules",
      API.userMonitorReplyRulesSet,
      { rules: text2 },
      delay,
      (value) => commitReplyRules(value.replyRules, text2)
    );
  };
  const toggle = () => act("toggle", () => rpc(connection, API.userMonitorEnable, { enabled: monitor?.enabled !== true }));
  const poll = () => act("poll", () => rpc(connection, API.userMonitorPoll, {}));
  const flushPending = () => act("flush", () => rpc(connection, API.userMonitorFlush, {}));
  const togglePicker = () => {
    const next = !showPicker;
    setShowPicker(next);
    if (next && !available) {
      void act("chats", async () => {
        const value = await rpc(connection, API.userMonitorChats, {});
        setAvailable(Array.isArray(value?.chats) ? value.chats : []);
        return null;
      });
    }
  };
  const chats = Array.isArray(monitor?.chats) ? monitor.chats : [];
  const monitored = new Set(chats.map((chat) => chat.chatId));
  const candidates = (available ?? []).filter((chat) => !monitored.has(chat.chatId));
  const pendingTotal = chats.reduce((sum, chat) => sum + (chat.pendingBatch || 0), 0);
  const formatTime = (ms) => Number.isFinite(ms) && ms > 0 ? new Date(ms).toLocaleTimeString() : "\u2014";
  const defaultWorkspaceId = workerOptions.defaultWorkspaceId ?? null;
  const workspaces = [...workerOptions.workspaces].sort((left, right) => {
    if (left.id === defaultWorkspaceId) return -1;
    if (right.id === defaultWorkspaceId) return 1;
    return 0;
  });
  const lastPollAt = Math.max(0, ...chats.map((chat) => Number(chat.lastPollAt) || 0));
  const control = { ...S.input, height: "36px" };
  const shortId = (id = "") => id.length > 22 ? `${id.slice(0, 10)}\u2026${id.slice(-6)}` : id;
  const chatKind = (chat) => chat.chatMode === "p2p" ? t("\u79C1\u804A", "Direct") : t("\u7FA4\u804A", "Group");
  const field = (label, props, options) => h2(
    "label",
    { className: "bxf-identity-field" },
    h2("span", null, label),
    h2("select", { ...props, style: control, className: "bxf-identity-control" }, options)
  );
  const chatRow = (chat) => {
    const mode = chat.mode ?? (chat.chatMode === "p2p" ? "all" : "mention");
    return h2(
      "div",
      { key: chat.chatId, className: "bxf-identity-chat" },
      h2(
        "div",
        { className: "bxf-identity-chat-main" },
        h2("div", { className: "bxf-identity-chat-title", title: chat.name || chat.chatId }, chat.name || chat.chatId),
        h2("div", { className: "bxf-identity-chat-meta", title: chat.chatId }, `${chatKind(chat)} \xB7 ${shortId(chat.chatId)}`)
      ),
      h2(
        "div",
        { className: "bxf-identity-chat-controls" },
        field(t("\u89E6\u53D1\u89C4\u5219", "Trigger"), {
          value: mode,
          disabled: busy === `mode:${chat.chatId}`,
          onChange: (event) => void setChat(chat, { mode: event.target.value })
        }, [
          h2("option", { key: "all", value: "all" }, t("\u5168\u90E8\u6D88\u606F", "All messages")),
          h2("option", { key: "mention", value: "mention" }, t("\u4EC5 @ \u4E0E\u56DE\u590D", "Mentions & replies")),
          h2("option", { key: "keyword", value: "keyword" }, t("\u5173\u952E\u8BCD", "Keywords"))
        ]),
        field(t("\u56DE\u590D\u5BF9\u8C61", "Reply to"), {
          value: chat.replyToBots ? "bots" : "human",
          disabled: busy === `mode:${chat.chatId}`,
          onChange: (event) => void setChat(chat, { replyToBots: event.target.value === "bots" })
        }, [
          h2("option", { key: "human", value: "human" }, t("\u4EC5\u771F\u4EBA", "People only")),
          h2("option", { key: "bots", value: "bots" }, t("\u5305\u542B\u673A\u5668\u4EBA", "People & bots"))
        ])
      ),
      h2("button", {
        type: "button",
        className: "bxf-mini bxf-danger bxf-identity-remove",
        disabled: busy === `remove:${chat.chatId}`,
        onClick: () => void remove(chat),
        "aria-label": `${t("\u79FB\u9664", "Remove")} ${chat.name || chat.chatId}`
      }, t("\u79FB\u9664", "Remove")),
      mode === "keyword" ? h2(
        "label",
        { className: "bxf-identity-field bxf-identity-chat-extra" },
        h2("span", null, t("\u5339\u914D\u5173\u952E\u8BCD", "Match keywords")),
        h2("input", {
          ...autoSave.compositionHandlers,
          style: control,
          className: "bxf-identity-control",
          defaultValue: (chat.keywords ?? []).join("\uFF0C"),
          placeholder: t("\u5173\u952E\u8BCD\uFF0C\u9017\u53F7\u5206\u9694", "Keywords, comma separated"),
          onChange: (event) => {
            const keywords = event.target.value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
            scheduleSetting(`keywords:${chat.chatId}`, API.userMonitorChatSet, { chatId: chat.chatId, keywords });
          },
          onBlur: () => void autoSave.flush()
        })
      ) : null,
      chat.lastError ? h2("div", { className: "bxf-identity-alert bxf-identity-chat-extra", role: "alert" }, chat.lastError) : null
    );
  };
  const keyword = chatFilter.trim().toLowerCase();
  const filtered = keyword ? (available ?? []).filter((chat) => `${chat.name || ""} ${chat.chatId}`.toLowerCase().includes(keyword)) : candidates;
  const pickerSection = showPicker ? h2(
    "div",
    { className: "bxf-identity-picker" },
    h2("input", {
      style: control,
      className: "bxf-identity-control",
      value: chatFilter,
      autoFocus: true,
      "aria-label": t("\u641C\u7D22\u4F1A\u8BDD", "Search chats"),
      placeholder: t("\u641C\u7D22\u4F1A\u8BDD\u540D\u79F0\u6216 ID", "Search chat name or ID"),
      onChange: (event) => setChatFilter(event.target.value)
    }),
    available === null ? h2("p", { className: "bxf-identity-hint", role: "status" }, t("\u6B63\u5728\u8BFB\u53D6\u4F1A\u8BDD\u5217\u8868\u2026", "Loading chats\u2026")) : filtered.length === 0 ? h2("p", { className: "bxf-identity-hint" }, keyword ? t("\u6CA1\u6709\u627E\u5230\u5339\u914D\u7684\u4F1A\u8BDD\uFF0C\u8BD5\u8BD5\u5176\u4ED6\u5173\u952E\u8BCD\u3002", "No matching chats. Try another keyword.") : t("\u6240\u6709\u53EF\u7528\u4F1A\u8BDD\u90FD\u5DF2\u6DFB\u52A0\u3002", "All available chats have been added.")) : h2("div", { className: "bxf-identity-picker-list" }, filtered.map((chat) => {
      const added = monitored.has(chat.chatId);
      return h2(
        "div",
        { key: chat.chatId, className: "bxf-identity-candidate" },
        h2(
          "div",
          { className: "bxf-identity-candidate-info" },
          h2("strong", { title: chat.name || chat.chatId }, chat.name || chat.chatId),
          h2("span", { className: "bxf-identity-chat-meta", title: chat.chatId }, `${chatKind(chat)} \xB7 ${shortId(chat.chatId)}`)
        ),
        h2("button", {
          type: "button",
          className: "bxf-mini",
          disabled: added || busy === `add:${chat.chatId}`,
          onClick: () => void add(chat)
        }, added ? t("\u5DF2\u6DFB\u52A0", "Added") : busy === `add:${chat.chatId}` ? t("\u6DFB\u52A0\u4E2D\u2026", "Adding\u2026") : t("\u6DFB\u52A0", "Add"))
      );
    }))
  ) : null;
  return h2(
    import_react3.default.Fragment,
    null,
    error ? h2("div", { className: "bxf-identity-alert", role: "alert" }, error) : null,
    h2(SaveStatus, { state: autoSave.state, onRetry: autoSave.retry }),
    h2(
      IdentityCard,
      {
        title: t("\u6D88\u606F\u76D1\u542C", "Message monitoring"),
        kind: "monitor",
        defaultOpen: true,
        description: monitor ? `${t("\u5DF2\u9009\u4F1A\u8BDD", "Selected chats")} ${chats.length} \xB7 ${lastPollAt ? `${t("\u6700\u8FD1\u68C0\u67E5", "Last checked")} ${formatTime(lastPollAt)}` : t("\u5C1A\u672A\u68C0\u67E5", "Not checked yet")}` : t("\u6B63\u5728\u8BFB\u53D6\u76D1\u542C\u72B6\u6001\u2026", "Loading monitor status\u2026"),
        badge: monitor ? h2("span", { style: S.badge(monitor.enabled ? "ok" : "muted") }, monitor.enabled ? t("\u76D1\u542C\u4E2D", "Watching") : t("\u5DF2\u6682\u505C", "Paused")) : null
      },
      !monitor ? h2("p", { className: "bxf-identity-hint", role: "status" }, t("\u6B63\u5728\u8BFB\u53D6\u76D1\u542C\u72B6\u6001\u2026", "Loading monitor status\u2026")) : h2(
        import_react3.default.Fragment,
        null,
        h2(
          "div",
          { className: "bxf-identity-list-head" },
          h2("button", {
            type: "button",
            style: S.btn(monitor.enabled ? void 0 : "primary"),
            disabled: busy === "toggle",
            onClick: () => void toggle()
          }, monitor.enabled ? t("\u505C\u6B62\u76D1\u542C", "Stop monitoring") : t("\u5F00\u59CB\u76D1\u542C", "Start monitoring")),
          h2(
            "div",
            { className: "bxf-identity-actions" },
            h2("button", { type: "button", className: "bxf-mini", disabled: busy === "poll", onClick: () => void poll() }, busy === "poll" ? t("\u68C0\u67E5\u4E2D\u2026", "Checking\u2026") : t("\u7ACB\u5373\u68C0\u67E5", "Check now")),
            h2(
              "button",
              { type: "button", className: "bxf-mini", disabled: busy === "chats", "aria-expanded": showPicker, onClick: togglePicker },
              showPicker ? t("\u6536\u8D77\u5217\u8868", "Hide list") : t("\u6DFB\u52A0\u4F1A\u8BDD", "Add chat")
            )
          )
        ),
        chats.length ? h2("div", { className: "bxf-identity-chat-list" }, chats.map(chatRow)) : h2("div", { className: "bxf-identity-empty" }, t("\u6DFB\u52A0\u9700\u8981\u81EA\u52A8\u56DE\u590D\u7684\u4F1A\u8BDD\uFF0C\u7136\u540E\u8BBE\u7F6E\u89E6\u53D1\u89C4\u5219\u3002", "Add a chat to reply to, then choose a trigger.")),
        pickerSection,
        pendingTotal > 0 ? h2(
          "div",
          { className: "bxf-identity-list-head", style: { margin: "10px 0 0" } },
          h2("span", { className: "bxf-identity-list-meta" }, `${pendingTotal} ${t("\u6761\u6D88\u606F\u5F85\u5904\u7406", "messages pending")}`),
          h2(
            "button",
            { type: "button", className: "bxf-mini", disabled: busy === "flush", onClick: () => void flushPending() },
            busy === "flush" ? t("\u6D3E\u53D1\u4E2D\u2026", "Dispatching\u2026") : t("\u91CD\u8BD5\u6D3E\u53D1", "Retry dispatch")
          )
        ) : null
      )
    ),
    h2(IdentityCard, {
      title: t("\u81EA\u52A8\u56DE\u590D\u8BBE\u7F6E", "Auto-reply settings"),
      kind: "reply",
      description: t("\u8F6C\u4EBA\u5DE5\u3001\u5904\u7406\u4F1A\u8BDD\u4E0E\u56DE\u590D\u89C4\u5219", "Handoff, reply session and reply rules")
    }, monitor ? h2(
      "div",
      { className: "bxf-identity-settings" },
      h2(
        "div",
        { className: "bxf-identity-setting" },
        h2(
          "label",
          { className: "bxf-identity-field" },
          h2("strong", { className: "bxf-identity-setting-title" }, t("\u8F6C\u4EBA\u5DE5\u5173\u952E\u8BCD", "Handoff keywords")),
          h2("input", {
            ...autoSave.compositionHandlers,
            style: control,
            className: "bxf-identity-control",
            value: handoffText,
            placeholder: t("\u8F6C\u4EBA\u5DE5\uFF0C\u4EBA\u5DE5\u5BA2\u670D", "human, agent"),
            onChange: (event) => updateHandoff(event.target.value),
            onBlur: () => void autoSave.flush(),
            onKeyDown: (event) => {
              if (event.key === "Enter" && !event.nativeEvent?.isComposing) void autoSave.flush();
            }
          })
        ),
        h2("p", { className: "bxf-identity-hint" }, t("\u7528\u9017\u53F7\u5206\u9694\u3002\u547D\u4E2D\u65F6\u8DF3\u8FC7\u5F53\u524D\u56DE\u590D\uFF0C\u4EA4\u7531\u4EBA\u5DE5\u5904\u7406\u3002", "Separate with commas. Matching messages are left for a person."))
      ),
      h2(
        "div",
        { className: "bxf-identity-setting" },
        h2("p", { className: "bxf-identity-setting-title" }, t("\u5904\u7406\u4F1A\u8BDD", "Reply session")),
        h2(
          "div",
          { className: "bxf-identity-worker" },
          field(t("\u5206\u7EC4", "Group"), {
            value: monitor.worker?.workspaceId || defaultWorkspaceId || "",
            disabled: busy === "worker",
            title: workspaces.find((item) => item.id === (monitor.worker?.workspaceId || defaultWorkspaceId))?.path || "",
            onChange: (event) => void setWorker({ workspaceId: event.target.value, workspacePath: "" })
          }, workspaces.map((item) => h2(
            "option",
            { key: item.id, value: item.id, title: item.path || "" },
            `${item.title || item.path?.split("/").filter(Boolean).at(-1) || item.id}${item.id === defaultWorkspaceId ? t("\uFF08\u9ED8\u8BA4\uFF09", " (default)") : ""}`
          ))),
          field(t("\u9884\u8BBE", "Preset"), { value: monitor.worker?.preset || "", disabled: busy === "worker", onChange: (event) => void setWorker({ preset: event.target.value }) }, [
            h2("option", { key: "", value: "" }, t("\u9ED8\u8BA4", "Default")),
            ...workerOptions.presets.map((item) => h2("option", { key: item.id, value: item.id }, item.name || item.id))
          ])
        ),
        h2("p", { className: "bxf-identity-hint" }, t("\u66F4\u6539\u540E\uFF0C\u5C06\u5728\u4E0B\u6B21\u81EA\u52A8\u56DE\u590D\u65F6\u521B\u5EFA\u65B0\u4F1A\u8BDD\u3002", "Changes create a new session on the next automatic reply."))
      ),
      h2(
        "div",
        { className: "bxf-identity-setting" },
        h2(
          "div",
          { className: "bxf-identity-section-head" },
          h2("h3", { className: "bxf-identity-setting-title" }, t("\u5206\u8EAB\u56DE\u590D\u89C4\u5219", "Avatar reply rules")),
          h2("button", {
            type: "button",
            className: "bxf-mini",
            onClick: () => updateReplyRules(monitor.defaultReplyRules ?? "", 0)
          }, t("\u6062\u590D\u9ED8\u8BA4\u6A21\u677F", "Restore default template"))
        ),
        h2("textarea", {
          ...autoSave.compositionHandlers,
          style: { ...S.area, minHeight: "220px", padding: "12px", fontSize: "13px" },
          className: "bxf-identity-rules",
          rows: 10,
          "aria-label": t("\u5206\u8EAB\u56DE\u590D\u89C4\u5219", "Avatar reply rules"),
          value: replyRules,
          onChange: (event) => updateReplyRules(event.target.value),
          spellCheck: false,
          onBlur: () => void autoSave.flush()
        })
      )
    ) : h2("p", { className: "bxf-identity-hint", role: "status" }, t("\u6B63\u5728\u8BFB\u53D6\u2026", "Loading\u2026")))
  );
}
function UserIdentityModal({ connection, bot, status, error, onClose, onRefresh }) {
  const [busy, setBusy] = import_react3.default.useState("");
  const [notice, setNotice] = import_react3.default.useState(null);
  const [confirmDisconnect, setConfirmDisconnect] = import_react3.default.useState(false);
  const saveRef = import_react3.default.useRef(null);
  const currentApp = status?.config?.app;
  const currentBot = Boolean(currentApp?.botId && bot?.id && currentApp.botId === bot.id);
  const pending = status?.connect?.phase === "pending" && currentBot;
  const requestClose = import_react3.default.useCallback(async () => {
    if (saveRef.current && !await saveRef.current()) return;
    if (pending) {
      void rpc(connection, API.userConnectCancel, {}).then(onRefresh).catch(() => void 0);
    }
    onClose();
  }, [pending, connection, onRefresh, onClose]);
  import_react3.default.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !event.isComposing) void requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);
  import_react3.default.useEffect(() => {
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
    setNotice({ tone: "ok", text: t("\u51ED\u8BC1\u5DF2\u5237\u65B0", "Credentials refreshed") });
  });
  const authorized = Boolean(status?.authorization?.authorized) && currentBot;
  const user = status?.authorization?.user;
  const formatTime = (ms) => Number.isFinite(ms) && ms > 0 ? new Date(ms).toLocaleString() : "\u2014";
  const refreshExpiresAt = status?.authorization?.refreshTokenExpiresAt;
  const hasRefreshExpiry = Number.isFinite(refreshExpiresAt) && refreshExpiresAt > 0 && Number.isFinite(new Date(refreshExpiresAt).getTime());
  const refreshExpired = authorized && hasRefreshExpiry && refreshExpiresAt <= Date.now();
  const expiryDescription = !authorized ? null : hasRefreshExpiry ? `${t("\u6388\u6743\u5230\u671F", "Authorization expires")} \xB7 ${formatTime(refreshExpiresAt)}` : t("\u6388\u6743\u5230\u671F\u65F6\u95F4\u672A\u77E5", "Authorization expiry unavailable");
  const displayName = user?.name || t("\u672A\u547D\u540D\u7528\u6237", "Unnamed user");
  let body;
  if (!status) {
    body = h2(
      "div",
      { className: "bxf-identity-connect" },
      h2("p", { className: "bxf-identity-hint" }, error ? t("\u8BFB\u53D6\u72B6\u6001\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002", "Unable to load status. Please retry.") : t("\u6B63\u5728\u8BFB\u53D6\u2026", "Loading\u2026")),
      h2("button", { type: "button", style: S.btn(), onClick: () => void onRefresh() }, t("\u91CD\u8BD5", "Retry"))
    );
  } else if (pending) {
    body = h2(
      "div",
      { className: "bxf-identity-connect" },
      h2("strong", null, t("\u626B\u7801\u8FDE\u63A5\u98DE\u4E66", "Scan to connect Feishu")),
      h2("p", { className: "bxf-identity-hint" }, t("\u626B\u7801\u540E\u5728\u98DE\u4E66\u786E\u8BA4\u3002", "Confirm in Feishu after scanning.")),
      status.connect?.qrCodeDataUrl ? h2(
        "div",
        { className: "bxf-identity-qr" },
        h2("img", { src: status.connect.qrCodeDataUrl, width: 180, height: 180, alt: t("\u98DE\u4E66\u6388\u6743\u4E8C\u7EF4\u7801", "Feishu authorization QR code") })
      ) : null
    );
  } else if (authorized) {
    body = h2(
      import_react3.default.Fragment,
      null,
      status.authorization?.scopeSatisfied === false ? h2(
        "div",
        { className: "bxf-identity-alert", role: "alert" },
        `${t("\u5F53\u524D\u6388\u6743\u7F3A\u5C11\u6743\u9650\uFF0C\u8BF7\u91CD\u65B0\u6388\u6743\uFF1A", "Authorization is missing scopes; re-authorize: ")}${(status.authorization.missingScopes ?? []).slice(0, 6).join("\u3001")}${(status.authorization.missingScopes?.length ?? 0) > 6 ? " \u2026" : ""}`
      ) : null,
      h2(
        "dl",
        { className: "bxf-identity-facts" },
        h2("dt", null, "Open ID"),
        h2("dd", null, user?.openId || "\u2014"),
        h2("dt", null, t("\u8BBF\u95EE\u51ED\u8BC1\u5230\u671F", "Access token expires")),
        h2("dd", null, formatTime(status.authorization?.accessTokenExpiresAt)),
        h2("dt", null, t("\u5237\u65B0\u51ED\u8BC1\u5230\u671F", "Refresh token expires")),
        h2("dd", null, formatTime(status.authorization?.refreshTokenExpiresAt))
      ),
      h2(
        "div",
        { className: "bxf-identity-actions" },
        h2("button", { type: "button", style: S.btn(), disabled: Boolean(busy), onClick: () => void connect() }, t("\u91CD\u65B0\u6388\u6743", "Re-authorize")),
        h2("button", { type: "button", style: S.btn(), disabled: Boolean(busy), onClick: () => void refreshToken() }, busy === "refresh" ? t("\u5237\u65B0\u4E2D\u2026", "Refreshing\u2026") : t("\u5237\u65B0\u51ED\u8BC1", "Refresh credentials")),
        h2("button", { type: "button", style: { ...S.btn(), color: "var(--dsw-alias-state-error-primary)" }, disabled: Boolean(busy), onClick: () => void disconnect() }, confirmDisconnect ? t("\u786E\u8BA4\u65AD\u5F00\uFF1F", "Confirm disconnect?") : t("\u65AD\u5F00\u6388\u6743", "Disconnect"))
      )
    );
  } else {
    body = h2(
      "div",
      { className: "bxf-identity-connect" },
      h2("p", { className: "bxf-identity-hint", style: { marginBottom: "16px" } }, t("\u8FDE\u63A5\u98DE\u4E66\u8D26\u53F7\u540E\uFF0C\u5373\u53EF\u8BBE\u7F6E\u6D88\u606F\u76D1\u542C\u4E0E\u81EA\u52A8\u56DE\u590D\u3002", "Connect your Feishu account to set up monitoring and automatic replies.")),
      h2(
        "div",
        { className: "bxf-identity-actions", style: { justifyContent: "center" } },
        h2("button", { type: "button", style: S.btn("primary"), disabled: Boolean(busy), onClick: () => void connect() }, busy === "connect" ? t("\u6B63\u5728\u53D1\u8D77\u2026", "Starting\u2026") : t("\u8FDE\u63A5\u98DE\u4E66", "Connect Feishu")),
        h2("button", { type: "button", style: S.btn(), onClick: () => void onRefresh() }, t("\u5237\u65B0\u72B6\u6001", "Refresh"))
      )
    );
  }
  return h2(
    "div",
    {
      className: "bxf-identity-overlay",
      style: S.overlay,
      onClick: (event) => {
        if (event.target === event.currentTarget) requestClose();
      }
    },
    h2("style", null, IDENTITY_CSS),
    h2(
      "div",
      { className: "bxf-identity-dialog", role: "dialog", "aria-modal": true, "aria-label": t("\u98DE\u4E66\u5206\u8EAB", "Feishu identity") },
      h2(
        "header",
        { className: "bxf-identity-header" },
        h2("h2", null, t("\u98DE\u4E66\u5206\u8EAB", "Feishu identity")),
        h2("button", {
          type: "button",
          className: "bxf-identity-close",
          onClick: requestClose,
          "aria-label": pending ? t("\u53D6\u6D88\u6388\u6743", "Cancel authorization") : t("\u5173\u95ED", "Close")
        }, "\xD7")
      ),
      h2(
        "div",
        { className: "bxf-identity-body" },
        notice ? h2("div", { className: notice.tone === "error" ? "bxf-identity-alert" : "bxf-identity-notice", role: "status" }, notice.text) : null,
        !notice && error ? h2("div", { className: "bxf-identity-alert", role: "alert" }, error) : null,
        h2(IdentityCard, {
          key: pending ? "pending" : authorized ? "connected" : "connect",
          title: authorized ? displayName : !status ? t("\u98DE\u4E66\u8D26\u53F7", "Feishu account") : pending ? t("\u626B\u7801\u8FDE\u63A5\u98DE\u4E66", "Scan to connect Feishu") : t("\u8FDE\u63A5\u98DE\u4E66", "Connect Feishu"),
          kind: "account",
          avatar: authorized ? h2("span", { className: "bxf-identity-avatar", "aria-hidden": true }, [...displayName][0]) : null,
          description: expiryDescription,
          descriptionClassName: `bxf-identity-expiry${refreshExpired ? " bxf-identity-expiry-expired" : ""}`,
          descriptionTitle: t("\u5237\u65B0\u51ED\u8BC1\u5230\u671F\u540E\u9700\u91CD\u65B0\u6388\u6743\uFF1B\u6B64\u65F6\u95F4\u968F\u51ED\u8BC1\u5237\u65B0\u66F4\u65B0\u3002", "Re-authorize when the refresh token expires. This time updates when credentials are refreshed."),
          defaultOpen: !authorized || pending || refreshExpired || status?.authorization?.scopeSatisfied === false,
          badge: status ? h2(
            "span",
            { style: S.badge(pending || refreshExpired || authorized && status.authorization?.scopeSatisfied === false ? "warn" : authorized ? "ok" : "muted") },
            pending ? t("\u7B49\u5F85\u626B\u7801", "Awaiting scan") : refreshExpired ? t("\u9700\u91CD\u65B0\u6388\u6743", "Re-authorization required") : authorized && status.authorization?.scopeSatisfied === false ? t("\u6388\u6743\u4E0D\u5B8C\u6574", "Incomplete authorization") : authorized ? t("\u5DF2\u8FDE\u63A5", "Connected") : t("\u672A\u8FDE\u63A5", "Disconnected")
          ) : null
        }, body),
        authorized && !pending ? h2(MonitorPanel, { connection, saveRef }) : null
      )
    )
  );
}
function UserIdentityButton({ connection, bot }) {
  const { data: status, error, refresh: load } = useRpcQuery(connection, API.userStatus);
  const [open, setOpen] = import_react3.default.useState(false);
  const connecting = status?.connect?.phase === "pending";
  usePolling(load, { interval: connecting ? 1500 : 3e4, enabled: open || connecting || !status, scope: connection });
  const currentApp = status?.config?.app;
  const currentBot = Boolean(currentApp?.botId && bot?.id && currentApp.botId === bot.id);
  const authorized = Boolean(status?.authorization?.authorized) && currentBot;
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

// client/bot-settings.js
var ids = (text2) => text2.split(/[\s,;，；、]+/).map((item) => item.trim()).filter(Boolean);
var model = (draft) => draft.provider && draft.model ? { provider: draft.provider, model: draft.model, ...draft.reasoningEffort ? { reasoningEffort: draft.reasoningEffort } : {} } : null;
function botSettingUpdates(previous, next) {
  const updates = [];
  const changed = (method, payload, before, after, key = method) => {
    if (JSON.stringify(before) !== JSON.stringify(after)) updates.push({ key, method, payload });
  };
  changed(API.botWorkspaceSet, { workspace: next.workspace || null }, previous.workspace, next.workspace);
  changed(API.botModelSet, { model: model(next) }, model(previous), model(next));
  changed(API.botPresetSet, { preset: next.preset || null }, previous.preset, next.preset);
  changed(API.botProcessDetailSet, { mode: next.processDetail }, previous.processDetail, next.processDetail);
  changed(API.botPermissionSet, { permissionPreset: next.permissionPreset || null }, previous.permissionPreset, next.permissionPreset);
  for (const scope of ["direct", "group"]) {
    changed(API.botBusyModeSet, { scope, mode: next.busyMode[scope] }, previous.busyMode[scope], next.busyMode[scope], `${API.botBusyModeSet}:${scope}`);
  }
  changed(API.botContextSet, { config: next.contextEnhancement }, previous.contextEnhancement, next.contextEnhancement);
  changed(API.botBotReplySet, { enabled: next.respondBot }, previous.respondBot, next.respondBot);
  changed(API.botEavesdropSet, { eavesdrop: next.eavesdrop }, previous.eavesdrop, next.eavesdrop);
  changed(API.botMentionsSet, { mentions: next.mentions }, previous.mentions, next.mentions);
  const access = (draft) => ({ group: draft.group, allowOpenIds: ids(draft.allow), managers: ids(draft.managers) });
  changed(API.botAccessSet, { access: access(next) }, access(previous), access(next));
  return updates;
}

// client/details-style.js
var DETAILS_CSS = `
.bxf-details-dialog { width: min(560px, 100%); max-height: calc(100vh - 40px); max-height: calc(100dvh - 40px);
  display: flex; flex-direction: column; min-width: 0; overflow: hidden; border-radius: 16px;
  border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); background: var(--dsw-alias-bg-layer-1, #fff);
  color: var(--dsw-alias-label-primary, #1c1c1e); box-shadow: 0 24px 64px rgba(15,23,42,.22); font-size: 13px; line-height: 1.5; }
.bxf-details-dialog * { box-sizing: border-box; }
.bxf-details-header, .bxf-details-footer { display: flex; align-items: center; justify-content: space-between;
  flex: none; flex-wrap: wrap; gap: 12px; padding: 16px 20px; }
.bxf-details-header { border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-details-header h3 { margin: 0; font-size: 16px; font-weight: 650; }
.bxf-details-header button, .bxf-details-footer button { flex: none; white-space: nowrap; font-family: inherit; }
.bxf-details-body { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 18px 20px;
  display: flex; flex-direction: column; gap: 16px; }
.bxf-details-body > * { flex: none; min-width: 0; }
.bxf-details-profile { display: flex; align-items: center; gap: 12px; }
.bxf-details-avatar { flex: none; display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; font-size: 19px; font-weight: 600; }
.bxf-details-person { min-width: 0; flex: 1; }
.bxf-details-name { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; }
.bxf-details-name strong { font-size: 15px; overflow-wrap: anywhere; }
.bxf-details-meta { margin-top: 3px; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; }
.bxf-details-section { padding: 14px 16px; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.bxf-details-section h4 { margin: 0 0 12px; font-size: 12px; font-weight: 600; }
.bxf-details-facts { margin: 0; display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 10px 14px; }
.bxf-details-facts dt { color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; }
.bxf-details-facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.bxf-details-mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; }
.bxf-details-error { border-color: rgba(239,68,68,.2); background: rgba(239,68,68,.05); color: var(--dsw-alias-state-error-primary, #dc2626); overflow-wrap: anywhere; }
.bxf-details-error p { margin: 0; }
.bxf-details-footer { border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-details-footer > span { font-size: 12px; color: var(--dsw-alias-label-secondary, #6b7280); }
.bxf-details-dialog button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #3370ff); outline-offset: 3px; }
@media (max-width: 480px) {
  .bxf-details-header, .bxf-details-footer { padding: 14px 16px; }
  .bxf-details-body { padding: 14px 16px; gap: 12px; }
  .bxf-details-section { padding: 12px; }
  .bxf-details-facts { grid-template-columns: minmax(0, 1fr); gap: 3px; }
  .bxf-details-facts dd + dt { margin-top: 9px; }
}
`;

// client/bot.js
var h3 = import_react4.default.createElement;
function AddBotModal({ connection, mode = "manual", grant = null, onClose, onAdded }) {
  const [form, setForm] = import_react4.default.useState({ appId: "", appSecret: "" });
  const { data: scan, error: pollError, accept: setScan, refresh: poll, invalidate } = useRpcQuery(connection, API.provisionPoll);
  const { busy, error: actionError, run } = useMutation();
  const error = actionError ?? pollError;
  const [remaining, setRemaining] = import_react4.default.useState(0);
  const terminal = ["success", "denied", "expired", "error", "cancelled"].includes(scan?.state);
  usePolling(poll, { interval: Math.max(2e3, scan?.nextPollInMs ?? 3e3), enabled: Boolean(scan) && !terminal && !pollError && busy !== "scan", immediate: false, scope: connection });
  usePolling(() => setRemaining(remainingSeconds(scan?.expiresAt)), {
    interval: 1e3,
    enabled: Boolean(scan) && !terminal,
    scope: scan?.expiresAt
  });
  const callbacks = import_react4.default.useRef({ onAdded, onClose });
  callbacks.current = { onAdded, onClose };
  import_react4.default.useEffect(() => {
    if (scan?.state === "success") {
      callbacks.current.onAdded();
      callbacks.current.onClose();
    }
  }, [scan?.state]);
  const startScan = () => run("scan", () => {
    invalidate();
    return rpc(connection, API.provisionBegin, grant ? { botId: grant.id } : {});
  }, (snapshot) => {
    setRemaining(remainingSeconds(snapshot.expiresAt));
    setScan(snapshot);
  });
  const cancelScan = () => {
    invalidate();
    setScan(null);
    if (mode === "scan") void rpc(connection, API.provisionCancel, {}).catch(() => void 0);
    onClose();
  };
  const close = import_react4.default.useRef(cancelScan);
  close.current = cancelScan;
  import_react4.default.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const started = import_react4.default.useRef(false);
  import_react4.default.useEffect(() => {
    if (mode === "scan" && !started.current) {
      started.current = true;
      void startScan();
    }
  }, [mode]);
  const submit = () => run("submit", () => rpc(connection, API.botAdd, form), () => {
    onAdded();
    onClose();
  });
  return h3(
    "div",
    { style: S.overlay, role: "dialog", "aria-modal": true, onClick: (event) => {
      if (event.target === event.currentTarget) cancelScan();
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
          error || scan && ["denied", "expired", "error", "cancelled"].includes(scan.state) ? h3("button", { type: "button", style: S.btn("primary"), disabled: Boolean(busy), onClick: startScan }, t("\u91CD\u65B0\u751F\u6210", "Retry")) : null
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
        mode === "manual" ? h3("button", { type: "button", style: S.btn(), onClick: cancelScan, disabled: busy }, t("\u53D6\u6D88", "Cancel")) : null,
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
  const [value, setValue] = import_react4.default.useState(bot.alias ?? "");
  const [color, setColor] = import_react4.default.useState(bot.color ?? "blue");
  const autoSave = useAutoSave();
  const requestClose = import_react4.default.useCallback(async () => {
    if (await autoSave.flush()) onClose();
  }, [autoSave.flush, onClose]);
  import_react4.default.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !event.isComposing) void requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);
  return h3(
    "div",
    { ...autoSave.compositionHandlers, style: S.overlay, role: "dialog", "aria-modal": true, onClick: (event) => {
      if (event.target === event.currentTarget) void requestClose();
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
          onChange: (event) => {
            const next = event.target.value;
            setValue(next);
            autoSave.schedule("alias", () => rpc(connection, API.botAliasSet, { botId: bot.id, alias: next.trim() || null }), 600, onSaved);
          },
          onBlur: () => void autoSave.flush(),
          onKeyDown: (event) => {
            if (event.key === "Enter" && !event.nativeEvent?.isComposing) void requestClose();
          }
        }),
        h3(
          "div",
          null,
          h3("label", { style: S.label }, t("\u6807\u8BC6\u8272", "Accent color")),
          h3(
            "div",
            { style: { display: "flex", gap: "8px" } },
            Object.entries(BOT_COLORS2).map(([key, palette]) => h3("button", {
              key,
              type: "button",
              title: text(COLOR_NAMES[key]),
              "aria-label": text(COLOR_NAMES[key]),
              onClick: () => {
                setColor(key);
                autoSave.schedule("color", () => rpc(connection, API.botColorSet, { botId: bot.id, color: key }), 0, onSaved);
              },
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
        h3(SaveStatus, { state: autoSave.state, onRetry: autoSave.retry })
      ),
      h3(
        "div",
        { style: { ...S.row, justifyContent: "flex-end", marginTop: "14px" } },
        h3("button", { type: "button", style: S.btn(), onClick: requestClose }, t("\u5173\u95ED", "Close"))
      )
    )
  );
}
function DetailsModal({ bot, onClose, onGrant }) {
  const [copied, setCopied] = import_react4.default.useState(false);
  const [copyError, setCopyError] = import_react4.default.useState(null);
  import_react4.default.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const title = bot.alias || bot.botName || t("\u98DE\u4E66\u673A\u5668\u4EBA", "Feishu bot");
  const accent = BOT_COLORS2[bot.color] ?? BOT_COLORS2.blue;
  const connectedAt = bot.connectedAt ? new Date(bot.connectedAt) : null;
  const connectedTime = connectedAt && Number.isFinite(connectedAt.getTime()) ? connectedAt.toLocaleString(navigator.language || void 0) : "\u2014";
  const section = (heading, rows) => h3(
    "section",
    { className: "bxf-details-section" },
    h3("h4", null, heading),
    h3("dl", { className: "bxf-details-facts" }, rows.map(([label, value, mono]) => h3(
      import_react4.default.Fragment,
      { key: label },
      h3("dt", null, label),
      h3("dd", { className: mono ? "bxf-details-mono" : void 0 }, value || "\u2014")
    )))
  );
  const copy = async () => {
    setCopyError(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(JSON.stringify(bot, null, 2));
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyError(t("\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5", "Copy failed. Please retry."));
    }
  };
  return h3(
    "div",
    { style: S.overlay, onClick: (event) => {
      if (event.target === event.currentTarget) onClose();
    } },
    h3("style", null, DETAILS_CSS),
    h3(
      "div",
      { className: "bxf-details-dialog", role: "dialog", "aria-modal": true, "aria-label": t("\u8FDE\u63A5\u8BE6\u60C5", "Connection details") },
      h3(
        "header",
        { className: "bxf-details-header" },
        h3("h3", null, t("\u8FDE\u63A5\u8BE6\u60C5", "Connection details")),
        h3("button", { type: "button", className: "bxf-mini", onClick: copy }, copied ? t("\u5DF2\u590D\u5236", "Copied") : t("\u590D\u5236\u8BE6\u60C5", "Copy details"))
      ),
      h3(
        "div",
        { className: "bxf-details-body" },
        h3(
          "div",
          { className: "bxf-details-profile" },
          h3("span", { className: "bxf-details-avatar", style: { color: accent.main, background: accent.soft }, "aria-hidden": true }, [...title][0]),
          h3(
            "div",
            { className: "bxf-details-person" },
            h3("div", { className: "bxf-details-name" }, h3("strong", null, title), h3(StatusBadge, { state: bot.state })),
            h3("div", { className: "bxf-details-meta" }, `${t("\u7ED1\u5B9A\u4F1A\u8BDD", "Bound chats")} \xB7 ${bot.boundChats ?? 0}`)
          )
        ),
        section(t("\u5E94\u7528\u4FE1\u606F", "Application"), [
          [t("\u5E94\u7528 ID", "App ID"), bot.appIdMasked || bot.appId, true],
          [t("\u673A\u5668\u4EBA", "Bot"), bot.botName],
          [t("\u673A\u5668\u4EBA Open ID", "Bot Open ID"), bot.botOpenId, true],
          [t("\u8FDE\u63A5\u65F6\u95F4", "Connected at"), connectedTime]
        ]),
        section(t("\u4F1A\u8BDD\u9ED8\u8BA4\u8BBE\u7F6E", "Session defaults"), [
          [t("\u5DE5\u4F5C\u533A", "Workspace"), bot.workspace || t("\u8DDF\u968F DSH \u9ED8\u8BA4", "Host default")],
          [t("\u9ED8\u8BA4\u6A21\u578B", "Model"), bot.model ? `${bot.model.provider} \xB7 ${bot.model.model}` : t("\u8DDF\u968F Host \u9ED8\u8BA4", "Host default")],
          ...bot.model?.reasoningEffort ? [[t("\u601D\u8003\u5F3A\u5EA6", "Reasoning effort"), bot.model.reasoningEffort]] : [],
          [t("Agent \u9884\u8BBE", "Agent preset"), bot.agentPreset || t("\u8DDF\u968F Host \u9ED8\u8BA4\u9884\u8BBE", "Host default preset")]
        ]),
        bot.lastError ? h3(
          "section",
          { className: "bxf-details-section bxf-details-error", role: "alert" },
          h3("h4", null, t("\u6700\u8FD1\u9519\u8BEF", "Last error")),
          h3("p", null, [bot.lastError.code, bot.lastError.message].filter(Boolean).join(" \xB7 "))
        ) : null,
        copyError ? h3("div", { style: S.error, role: "alert" }, copyError) : null
      ),
      h3(
        "footer",
        { className: "bxf-details-footer" },
        h3("span", null, t("\u5E94\u7528\u6743\u9650", "App permissions")),
        h3("button", { type: "button", style: S.btn(), onClick: onGrant }, t("\u8865\u9F50\u6743\u9650", "Grant permissions"))
      )
    )
  );
}
function BotCard({ connection, bot, models, presets, workspaces, permissionOptions, onChanged }) {
  const [open, setOpen] = import_react4.default.useState(false);
  const [aliasOpen, setAliasOpen] = import_react4.default.useState(false);
  const [detailsOpen, setDetailsOpen] = import_react4.default.useState(false);
  const [grantOpen, setGrantOpen] = import_react4.default.useState(false);
  const [draft, setDraft] = import_react4.default.useState(null);
  const draftRef = import_react4.default.useRef(null);
  const autoSave = useAutoSave();
  const [busy, setBusy] = import_react4.default.useState(null);
  const [error, setError] = import_react4.default.useState(null);
  const [notice, setNotice] = import_react4.default.useState(null);
  import_react4.default.useEffect(() => {
    if (!notice) return void 0;
    const timer = setTimeout(() => setNotice(null), 3e3);
    return () => clearTimeout(timer);
  }, [notice]);
  const seed = import_react4.default.useCallback((source = bot) => {
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
  const seedRef = import_react4.default.useRef(seed);
  seedRef.current = seed;
  import_react4.default.useEffect(() => {
    const initial = seedRef.current();
    draftRef.current = initial;
    setDraft(initial);
  }, [bot.id]);
  const run = async (key, task) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const result = await task();
      setNotice(key === "check" ? result.connected ? t("\u51ED\u8BC1\u6709\u6548\uFF0C\u957F\u8FDE\u63A5\u6B63\u5E38", "Credentials verified; connection is active") : t("\u51ED\u8BC1\u6709\u6548\uFF0C\u957F\u8FDE\u63A5\u672A\u5C31\u7EEA\uFF0C\u53EF\u70B9\u51FB\u91CD\u8FDE", "Credentials verified; connection is not ready. Reconnect to retry.") : t("\u64CD\u4F5C\u5B8C\u6210", "Done"));
      onChanged();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(null);
    }
  };
  const set = (patch, delay = 0) => {
    const previous = draftRef.current;
    const next = typeof patch === "function" ? patch(previous) : { ...previous, ...patch };
    draftRef.current = next;
    setDraft(next);
    for (const update of botSettingUpdates(previous, next)) {
      autoSave.schedule(update.key, () => rpc(connection, update.method, { botId: bot.id, ...update.payload }), delay, onChanged);
    }
  };
  const selectedModel = models.find((item) => item.provider === draft?.provider && item.model === draft?.model) ?? null;
  const title = bot.alias || bot.botName || t("\u98DE\u4E66\u673A\u5668\u4EBA", "Feishu bot");
  const scopeEditor = (scopeKey, label) => {
    const scope = draft.contextEnhancement[scopeKey] ?? emptyScope();
    const update = (patch, delay = 0) => set((current) => ({
      ...current,
      contextEnhancement: { ...current.contextEnhancement, [scopeKey]: { ...current.contextEnhancement[scopeKey], ...patch } }
    }), delay);
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
        onChange: (event) => update({ guidance: event.target.value }, 600),
        onBlur: () => void autoSave.flush()
      })
    );
  };
  const accent = BOT_COLORS2[bot.color] ?? BOT_COLORS2.blue;
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
          if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
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
          { className: "bxf-bot-meta" },
          h3("span", { style: { ...S.meta, marginTop: 0 } }, `${bot.appIdMasked ?? bot.appId ?? ""} \xB7 ${t("\u4F1A\u8BDD", "chats")} ${bot.boundChats ?? 0}`),
          h3(
            "div",
            { className: "bxf-bot-actions", onClick: (event) => event.stopPropagation() },
            h3("button", {
              type: "button",
              className: "bxf-mini",
              disabled: busy === "check",
              title: t("\u6821\u9A8C\u51ED\u8BC1\u4E0E\u957F\u8FDE\u63A5\u72B6\u6001\uFF0C\u4E0D\u53D1\u9001\u6D88\u606F", "Verify credentials and connection status without sending messages"),
              onClick: () => {
                void run("check", () => rpc(connection, API.botCheck, { botId: bot.id }));
              }
            }, busy === "check" ? t("\u68C0\u67E5\u4E2D\u2026", "Checking\u2026") : t("\u68C0\u67E5\u8FDE\u63A5", "Check connection")),
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
    error ? h3("div", { style: { ...S.error, padding: "0 16px 12px" }, role: "alert" }, error) : null,
    notice ? h3("div", { style: { ...S.hint, padding: "0 16px 12px" }, role: "status" }, notice) : null,
    autoSave.state.status !== "idle" ? h3("div", { style: { padding: "0 16px 10px" } }, h3(SaveStatus, { state: autoSave.state, onRetry: autoSave.retry })) : null,
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
      { ...autoSave.compositionHandlers, className: "bxf-bot-settings" },
      h3(
        Panel,
        { title: t("\u901A\u7528", "General"), defaultOpen: true, bodyClassName: "bxf-general-fields" },
        h3(
          Field,
          { label: t("\u9ED8\u8BA4\u5DE5\u4F5C\u533A", "Default workspace"), fullWidth: true, hint: t("\u5217\u8868\u6765\u81EA DSH \u5DF2\u767B\u8BB0\u7684\u5DE5\u4F5C\u533A\u3002", "From the workspaces DSH already knows.") },
          h3(
            "select",
            {
              style: S.input,
              value: draft.workspaceMode,
              title: draft.workspace || t("\u8DDF\u968F DSH \u9ED8\u8BA4", "Host default"),
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
          className: "bxf-field-wide",
          style: S.input,
          value: draft.workspaceCustom,
          placeholder: "/Users/you/work",
          "aria-label": t("\u81EA\u5B9A\u4E49\u8DEF\u5F84\u2026", "Custom path\u2026"),
          onChange: (event) => set({ workspaceCustom: event.target.value, workspace: event.target.value }, 600),
          onBlur: () => void autoSave.flush()
        }) : null,
        h3(
          Field,
          { label: t("\u9ED8\u8BA4\u6A21\u578B", "Model"), fullWidth: true, hint: t("\u53EA\u5F71\u54CD\u4E4B\u540E\u65B0\u5EFA\u7684\u4F1A\u8BDD\uFF0C\u5DF2\u6709\u4F1A\u8BDD\u4E0D\u53D8\u3002", "Applies only to Sessions created later.") },
          h3(
            "select",
            {
              style: S.input,
              value: draft.provider && draft.model ? `${draft.provider}/${draft.model}` : "",
              title: selectedModel?.label || t("\u8DDF\u968F Host \u9ED8\u8BA4", "Host default"),
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
          { label: t("Agent \u9884\u8BBE", "Agent preset"), hint: t("\u53EA\u5F71\u54CD\u4E4B\u540E\u65B0\u5EFA\u7684\u4F1A\u8BDD\uFF0C\u5DF2\u6709\u4F1A\u8BDD\u4E0D\u53D8\u3002", "Applies only to Sessions created later.") },
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
        { title: t("\u79C1\u804A", "Private chat") },
        h3(
          Field,
          { label: t("\u8FD0\u884C\u4E2D\u6536\u5230\u666E\u901A\u6D88\u606F", "While a turn runs") },
          h3(
            "select",
            { style: S.input, value: draft.busyMode.direct, onChange: (event) => set((current) => ({ ...current, busyMode: { ...current.busyMode, direct: event.target.value } })) },
            h3("option", { value: "queue" }, t("\u6392\u961F\u7B49\u5F85", "Queue")),
            h3("option", { value: "steer" }, t("\u63D2\u5165\u4E3A\u8865\u5145\u6307\u4EE4", "Steer"))
          )
        ),
        scopeEditor("direct", t("\u79C1\u804A\u4E0A\u4E0B\u6587\u6CE8\u5165", "Private-chat context"))
      ),
      h3(
        Panel,
        { title: t("\u7FA4\u804A", "Group chat") },
        h3(
          Field,
          { label: t("\u8FD0\u884C\u4E2D\u6536\u5230\u666E\u901A\u6D88\u606F", "While a turn runs") },
          h3(
            "select",
            { style: S.input, value: draft.busyMode.group, onChange: (event) => set((current) => ({ ...current, busyMode: { ...current.busyMode, group: event.target.value } })) },
            h3("option", { value: "queue" }, t("\u6392\u961F\u7B49\u5F85", "Queue")),
            h3("option", { value: "steer" }, t("\u63D2\u5165\u4E3A\u8865\u5145\u6307\u4EE4", "Steer"))
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
          h3("textarea", { style: S.area, value: draft.allow, onChange: (event) => set({ allow: event.target.value }, 600), onBlur: () => void autoSave.flush() })
        ) : null,
        h3(
          Field,
          { label: t("\u7BA1\u7406\u767D\u540D\u5355 Open ID\uFF08\u53EF\u6267\u884C /new\u3001\u505C\u6B62\u3001\u8C03\u6574\u4E0E\u5BA1\u6279\uFF09", "Manager allowlist (may run /new, stop, adjust and approve)"), hint: t("\u7559\u7A7A\u8868\u793A\u6CA1\u6709\u4EBA\u53EF\u4EE5\u5728\u7FA4\u91CC\u6267\u884C\u7BA1\u7406\u64CD\u4F5C\u3002", "Empty means nobody may manage in groups.") },
          h3("textarea", { style: S.area, value: draft.managers, onChange: (event) => set({ managers: event.target.value }, 600), onBlur: () => void autoSave.flush() })
        ),
        scopeEditor("group", t("\u7FA4\u804A\u4E0A\u4E0B\u6587\u6CE8\u5165", "Group-chat context"))
      ),
      h3(
        Panel,
        { title: t("\u79FB\u9664", "Remove"), danger: true },
        h3(
          "div",
          { style: { display: "flex", justifyContent: "flex-start" } },
          h3("button", {
            type: "button",
            className: "bxf-danger",
            style: S.dangerBtn,
            disabled: busy === "remove",
            onClick: () => {
              if (!window.confirm(t(`\u79FB\u9664\u300C${title}\u300D\uFF1F\u672C\u673A\u5C06\u5220\u9664\u8BE5\u673A\u5668\u4EBA\u7684\u914D\u7F6E\u4E0E\u5BC6\u94A5\uFF0C\u4E0D\u5F71\u54CD\u98DE\u4E66\u5E94\u7528\u672C\u8EAB\u3002`, `Remove ${title}? Local config and secret are deleted; the Feishu app stays.`))) return;
              void run("remove", async () => {
                await autoSave.flush();
                await rpc(connection, API.botRemove, { botId: bot.id });
              });
            }
          }, t("\u79FB\u9664\u6B64\u673A\u5668\u4EBA", "Remove this bot"))
        )
      )
    ) : null
  );
}

// client/settings.js
var h4 = import_react5.default.createElement;
function SettingsPage({ connection }) {
  const { data, error, loaded, refresh } = useRpcQuery(connection, API.botsList);
  const state = data ?? { bots: [], version: null };
  usePolling(refresh, { interval: 3e4, scope: connection });
  const [models, setModels] = import_react5.default.useState([]);
  const [presets, setPresets] = import_react5.default.useState([]);
  const [workspaces, setWorkspaces] = import_react5.default.useState([]);
  const [permissionOptions, setPermissionOptions] = import_react5.default.useState([]);
  const [addMode, setAddMode] = import_react5.default.useState(null);
  import_react5.default.useEffect(() => {
    if (!loaded || state.bots.length === 0) return;
    let alive = true;
    const botId = state.bots[0].id;
    void rpc(connection, API.modelsList, {}).then((catalog) => {
      if (!alive) return;
      const flat = [];
      for (const group of catalog.groups ?? []) {
        for (const model2 of group.models ?? []) {
          flat.push({ provider: group.id, model: model2.id, label: `${group.name} \xB7 ${model2.name}`, reasoning: model2.reasoning ?? null });
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
  if (!loaded || !data) {
    return h4(
      "div",
      { style: S.page },
      h4("h2", { style: S.title }, t("\u98DE\u4E66\u673A\u5668\u4EBA", "Feishu bots")),
      error ? h4(
        "div",
        null,
        h4("p", { style: S.error }, `${t("\u8BFB\u53D6\u5931\u8D25\uFF1A", "Failed: ")}${error}`),
        h4("button", { type: "button", style: S.btn("primary"), onClick: () => {
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
var h5 = import_react6.default.createElement;
function BoundPage({ connection, locale, ...props }) {
  import_react6.default.useSyncExternalStore(
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
