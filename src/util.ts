export const formatNumber = (num: number, precision = 1) => {
  const map = [
    { suffix: "T", threshold: 1e12 },
    { suffix: "B", threshold: 1e9 },
    { suffix: "M", threshold: 1e6 },
    { suffix: "K", threshold: 1e3 },
    { suffix: "", threshold: 1 },
  ];

  const found = map.find((x) => Math.abs(num) >= x.threshold);
  if (found) {
    return (num / found.threshold).toFixed(precision) + found.suffix;
  }

  return num;
};

export const formatYoutubeLink = (youtubeLink: string) => {
  return youtubeLink.replace(/\\/g, "");
};
