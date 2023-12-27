/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			backgroundImage: {
				'radial-gradiant': 'radial-gradient(white 1px, transparent 0)'
			},
		},
	},
	plugins: [require('daisyui')],
	daisyui: {
		themes: ["black"],
	},
}
