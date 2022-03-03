// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer/themes/github");
const darkCodeTheme = require("prism-react-renderer/themes/palenight");

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "GridPlus SDK",
  tagline: "The new standard for hardware wallets",
  url: "https://gridplus.io",
  baseUrl: "/gridplus-sdk/",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/logo.jpeg",
  organizationName: "gridplus",
  projectName: "gridplus-sdk",
  plugins: [
    [
      "docusaurus-plugin-typedoc",

      // Plugin / TypeDoc options
      {
        entryPoints: ["../src"],
        // entryPointStrategy: "expand",
        tsconfig: "../tsconfig.json",
        watch: process.env.TYPEDOC_WATCH,
        excludeInternal: true,
        excludePrivate: true,
        readme: "none",
      },
    ],
  ],
  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          // Please change this to your repo.
          editUrl: "https://github.com/gridplus/gridplus-sdk",
          remarkPlugins: [require("mdx-mermaid")],
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: "",
        logo: {
          alt: "Gridplus Logo",
          src: "img/logo.png",
        },
        items: [
          {
            type: "doc",
            docId: "index",
            position: "left",
            label: "Docs",
          },
          // {
          //   type: "docSidebar",
          //   position: "left",
          //   sidebarId: "api",
          //   label: "API",
          // },
          {
            href: "https://github.com/gridplus/gridplus-sdk",
            label: "GitHub",
            position: "right",
          },
        ],
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Community",
            items: [
              {
                label: "Stack Overflow",
                href: "https://stackoverflow.com/questions/tagged/gridplus",
              },
              {
                label: "Discord",
                href: "https://discordapp.com/invite/gridplus",
              },
              {
                label: "Twitter",
                href: "https://twitter.com/gridplus",
              },
            ],
          },
          {
            title: "More",
            items: [
              {
                label: "Blog",
                href: "https://blog.gridplus.io",
              },
              {
                label: "GitHub",
                href: "https://github.com/gridplus/gridplus-sdk",
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} GridPlus, Inc.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
