export default {
  name: "emailLog",
  title: "Email Log",
  type: "document",
  fields: [
    { name: "userId", type: "string" },
    { name: "to", type: "string" },
    { name: "subject", type: "string" },
    { name: "preview", type: "text" },
    { name: "sentAt", type: "datetime" },
    { name: "providerInfo", type: "string" },
  ],
};
