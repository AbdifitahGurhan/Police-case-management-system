import dayjs from 'dayjs';

const trimValue = (value) => (typeof value === 'string' ? value.trim() : value);

export const requiredRule = (label = 'This field') => ({
  required: true,
  transform: trimValue,
  message: `${label} is required.`,
});

export const textLengthRule = (label = 'This field', min = 2, max = 150) => ({
  validator: (_, value) => {
    const text = trimValue(value);
    if (!text) return Promise.resolve();
    if (text.length < min) return Promise.reject(new Error(`${label} must be at least ${min} characters.`));
    if (text.length > max) return Promise.reject(new Error(`${label} must be ${max} characters or fewer.`));
    return Promise.resolve();
  },
});

export const codeRule = (label = 'Code') => ({
  pattern: /^[A-Za-z0-9_-]{2,30}$/,
  message: `${label} can only use letters, numbers, hyphens, or underscores.`,
});

export const usernameRule = {
  pattern: /^[A-Za-z0-9_.-]{3,50}$/,
  message: 'Username must be 3-50 characters and use only letters, numbers, dots, hyphens, or underscores.',
};

export const passwordRule = {
  min: 8,
  message: 'Password must be at least 8 characters.',
};

export const phoneRule = {
  pattern: /^\+?[0-9\s-]{7,20}$/,
  message: 'Enter a valid phone number.',
};

export const emailRule = {
  type: 'email',
  message: 'Enter a valid email address.',
};

export const positiveIntegerRule = (label = 'Value', min = 1, max = 120) => ({
  validator: (_, value) => {
    if (value === undefined || value === null || value === '') return Promise.resolve();
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) {
      return Promise.reject(new Error(`${label} must be a whole number between ${min} and ${max}.`));
    }
    return Promise.resolve();
  },
});

export const noFutureDateRule = (label = 'Date') => ({
  validator: (_, value) => {
    if (!value) return Promise.resolve();
    if (dayjs(value).isAfter(dayjs(), 'day')) {
      return Promise.reject(new Error(`${label} cannot be in the future.`));
    }
    return Promise.resolve();
  },
});

export const noFutureDateTimeRule = (label = 'Date/time') => ({
  validator: (_, value) => {
    if (!value) return Promise.resolve();
    if (dayjs(value).isAfter(dayjs())) {
      return Promise.reject(new Error(`${label} cannot be in the future.`));
    }
    return Promise.resolve();
  },
});

export const disabledFutureDate = (current) => current && current.isAfter(dayjs().endOf('day'));

export const nameRules = (label = 'Name') => [requiredRule(label), textLengthRule(label, 2, 150)];
export const optionalNameRules = (label = 'Name') => [textLengthRule(label, 2, 150)];
export const phoneRules = [phoneRule];
export const requiredPhoneRules = [requiredRule('Phone number'), phoneRule];
export const usernameRules = [requiredRule('Username'), usernameRule];
export const passwordRules = [requiredRule('Password'), passwordRule];
export const optionalPasswordRules = [passwordRule];
export const codeRules = (label = 'Code') => [requiredRule(label), codeRule(label)];
