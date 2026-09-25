import { defineConfig } from 'vitepress'
import { createHighlighter } from 'shiki'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "meta-sgl",
  description: "Space Grade Linux",
  base: '/',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'GitHub', link: 'https://github.com/space-grade-linux/meta-sgl' }
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is SGL?', link: '/what-is-sgl' },
        ]
      },
      {
        text: 'Guides',
        items: [
          { text: 'Building', link: '/building' },
          { text: 'Building PIC64-HPSC QEMU', link: '/building-pic64hpsc' },
          { text: 'Contribute', link: '/contribute' },

        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/space-grade-linux/meta-sgl' },
      { icon: 'discord', link: 'https://chat.elisa.tech/' }
    ],

    footer: {
      message: 'Docs released under CC-BY-4.0 license. Code released under MIT license.',
      copyright: 'Space Grade Linux a Series of LF Projects, LLC'
    },
  },
  markdown: {
    async config(md) {
      const highlighter = await createHighlighter({
        themes: [ 'catppuccin-frappe', 'catppuccin-latte' ],
        langs: [
          'bash',
          'python',
          'json',
          'yaml',
          'cpp',
          'dockerfile',
          'makefile',
          'sh'
        ]
      })

      md.options.highlight = (code, lang) => {
        return highlighter.codeToHtml(code, {
          lang,
          theme: {
            light: 'catppuccin-latte',
            dark: 'catppuccin-frappe'
          }
        })
      }
    }
  },
})
