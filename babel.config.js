module.exports = {
  presets: ["@vue/cli-plugin-babel/preset"],
  plugins: [
    [
      "prismjs",
      {
        languages: ["javascript", "css", "markup", "typescript", 'ts'],
        plugins: ["line-numbers", "line-highlight"],
        css: true,
      },
    ],
  ],
};
