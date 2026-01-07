// @ts-check
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const typedocSidebar = { items: [
  {
    "type": "category",
    "label": "api",
    "items": [
      {
        "type": "doc",
        "id": "reference/api/addressTags",
        "label": "addressTags"
      },
      {
        "type": "doc",
        "id": "reference/api/addresses",
        "label": "addresses"
      },
      {
        "type": "doc",
        "id": "reference/api/setup",
        "label": "setup"
      },
      {
        "type": "doc",
        "id": "reference/api/signing",
        "label": "signing"
      },
      {
        "type": "doc",
        "id": "reference/api/wallets",
        "label": "wallets"
      }
    ]
  },
  {
    "type": "doc",
    "id": "reference/constants",
    "label": "constants"
  },
  {
    "type": "doc",
    "id": "reference/util",
    "label": "util"
  }
]};
module.exports = typedocSidebar.items;