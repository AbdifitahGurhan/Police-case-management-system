export const formatUSD = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
}).format(Number(value || 0));

export const usdInputProps = {
  min: 0,
  precision: 2,
  step: 0.01,
  stringMode: true,
  prefix: '$',
};
