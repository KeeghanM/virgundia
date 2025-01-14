import { defineConfig } from 'astro/config'
import tailwind from '@astrojs/tailwind'
import partytown from '@astrojs/partytown'

export default defineConfig({
  integrations: [
    tailwind(),
    partytown({
      config: {
        debug: true,
      },
    }),
  ],
})
