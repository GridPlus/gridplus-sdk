// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

import { themes } from 'prism-react-renderer';

const excludedFiles = [
  'bitcoin',
  'ethereum',
  'genericSigning',
  'index',
  'calldata/index',
].map((s) => `../src/${s}.ts`);

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'GridPlus SDK',
  tagline: 'The new standard for hardware wallets',
  url: 'https://gridplus.io',
  baseUrl: '/gridplus-sdk/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/logo.jpeg',
  organizationName: 'gridplus',
  projectName: 'gridplus-sdk',
  plugins: [
    [
      'docusaurus-plugin-typedoc',
      {
        id: 'gridplus-sdk',
        tsconfig: '../tsconfig.json',
        entryPoints: ['../src/api', '../src/constants.ts', '../src/util.ts'],
        entryFileName: 'index',
        out: './docs/reference',
        outputFileStrategy: 'modules',
        entryPointStrategy: 'expand',
        exclude: ['**/node_modules', '**/tests'],
        excludeNotDocumented: true,
        excludeInternal: true,
        excludePrivate: true,
        excludeGroups: true,
        readme: 'none',
        skipErrorChecking: true,
        expandParameters: true,
        expandObjects: true,
        parametersFormat: 'table',
        propertiesFormat: 'table',
        enumMembersFormat: 'table',
        typeDeclarationFormat: 'table',
        sanitizeComments: true,
        sidebar: {
          autoConfiguration: true,
          pretty: true,
        },
        plugin: ['typedoc-plugin-markdown'],
      },
    ],
  ],
  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          editUrl: 'https://github.com/gridplus/gridplus-sdk',
          remarkPlugins: [require('mdx-mermaid')],
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: '',
        logo: {
          alt: 'Gridplus Logo',
          src: 'img/logo.png',
        },
        items: [
          {
            type: 'doc',
            docId: 'index',
            position: 'left',
            label: 'Docs',
          },
          // {
          //   type: "docSidebar",
          //   position: "left",
          //   sidebarId: "api",
          //   label: "API",
          // },
          {
            href: 'https://github.com/gridplus/gridplus-sdk',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Community',
            items: [
              {
                label: 'Stack Overflow',
                href: 'https://stackoverflow.com/questions/tagged/gridplus',
              },
              {
                label: 'Discord',
                href: 'https://discordapp.com/invite/gridplus',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/gridplus',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Blog',
                href: 'https://blog.gridplus.io',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/gridplus/gridplus-sdk',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} GridPlus, Inc.`,
      },
      prism: {
        theme: themes.dracula,
        darkTheme: themes.dracula,
      },
    }),
};

module.exports = config;
