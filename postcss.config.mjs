const config = {
  plugins: [
    "@tailwindcss/postcss",
    "postcss-import",
    ["cssnano", process.env.NODE_ENV === 'production' ? {
      preset: ['advanced', {
        discardComments: { removeAll: true },
        reduceIdents: false,
        zindex: false
      }]
    } : false]
  ]
};

export default config;
