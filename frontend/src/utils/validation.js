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
  pattern: /^[A-Za-z0-9_.@-]{3,50}$/, 
  message: 'Username must be 3-50 characters and use only letters, numbers, dots, hyphens, underscores, or @.',
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

export const disabledUnder8DobDate = (current) => current && current.isAfter(dayjs().subtract(8, 'year').endOf('day'));

export const minimumAge8Rule = (label = 'Taariikhda dhalashada') => ({
  validator: (_, value) => {
    if (!value) return Promise.resolve();
    const dob = dayjs(value);
    if (!dob.isValid()) return Promise.resolve();
    const age = dayjs().diff(dob, 'year');
    if (age < 8) {
      return Promise.reject(new Error(`Da'da eedaysanaha/dambiilaha la ma ogola inay ka yaraato 8 jir (Age must be at least 8 years old).`));
    }
    return Promise.resolve();
  },
});

export const nameRules = (label = 'Name') => [requiredRule(label), textLengthRule(label, 2, 150)];
export const optionalNameRules = (label = 'Name') => [textLengthRule(label, 2, 150)];
export const phoneRules = [phoneRule];
export const requiredPhoneRules = [requiredRule('Phone number'), phoneRule];
export const usernameRules = [requiredRule('Username'), usernameRule];
export const passwordRules = [requiredRule('Password'), passwordRule];
export const optionalPasswordRules = [passwordRule];
export const codeRules = (label = 'Code') => [requiredRule(label), codeRule(label)];

export const dynamicIdNumberRule = (idTypeFieldName = 'id_type') => ({ getFieldValue }) => ({
  validator(_, value) {
    const text = trimValue(value);
    if (!text) return Promise.resolve();

    const idType = getFieldValue(idTypeFieldName) || 'National ID';

    if (idType === 'National ID') {
      if (text.length !== 14) {
        return Promise.reject(new Error('National ID-ga waa inuu ka koobnaadaa 14 meelood (14 characters/digits).'));
      }
    } else if (idType === 'Passport') {
      if (text.length !== 9) {
        return Promise.reject(new Error('Passport-ku waa inuu ka koobnaadaa 9 meelood (sida X99999999).'));
      }
      if (!/^[A-Za-z0-9]{9}$/.test(text)) {
        return Promise.reject(new Error('Passport-ku waa inuu ka koobnaadaa 9 meelood (sida X99999999).'));
      }
    }
    return Promise.resolve();
  },
});

export const getEvidenceUploadConfig = (evidenceType = 'document') => {
  const normType = String(evidenceType || 'document').toLowerCase();
  if (normType === 'document') {
    return {
      label: 'Faylka Dokumiintiga ah (PDF, DOC, DOCX, TXT, XLS, XLSX)',
      accept: '.pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buttonText: 'Soo xaree Dokumiinti',
      validate: (file) => {
        const ext = file.name ? file.name.substring(file.name.lastIndexOf('.')).toLowerCase() : '';
        const allowedExts = ['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.csv', '.rtf'];
        const isMedia = file.type?.startsWith('image/') || file.type?.startsWith('video/') || file.type?.startsWith('audio/');
        
        if (isMedia || !allowedExts.includes(ext)) {
          return 'Fadlan soo geli dokumiinti (PDF, DOC, DOCX, TXT, XLS) oo keliya. Sawirrada ama fiidiyowyada la ma oggola noocan dokumiintiga ah.';
        }
        return null;
      }
    };
  } else if (normType === 'photo' || normType === 'image') {
    return {
      label: 'Sawirka Caddeynta (JPG, JPEG, PNG, WEBP)',
      accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
      buttonText: 'Soo xaree Sawir',
      validate: (file) => {
        const ext = file.name ? file.name.substring(file.name.lastIndexOf('.')).toLowerCase() : '';
        const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
        if (!file.type?.startsWith('image/') && !allowedExts.includes(ext)) {
          return 'Fadlan soo geli sawir (JPG, JPEG, PNG, WEBP) oo keliya. Dokumiintiyada ama fiidiyowga la ma oggola noocan.';
        }
        return null;
      }
    };
  } else if (normType === 'video') {
    return {
      label: 'Fiidiyowga Caddeynta (MP4, MOV, AVI, WEBM)',
      accept: '.mp4,.mov,.avi,.webm,video/mp4,video/quicktime,video/x-msvideo,video/webm',
      buttonText: 'Soo xaree Fiidiyow',
      validate: (file) => {
        const ext = file.name ? file.name.substring(file.name.lastIndexOf('.')).toLowerCase() : '';
        const allowedExts = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
        if (!file.type?.startsWith('video/') && !allowedExts.includes(ext)) {
          return 'Fadlan soo geli fiidiyow (MP4, MOV, AVI, WEBM) oo keliya. Sawirrada ama dokumiintiyada la ma oggola noocan.';
        }
        return null;
      }
    };
  }
  return {
    label: 'Faylka Caddeynta (PDF, DOC, Sawir, ama ZIP)',
    accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png,.zip,.rar',
    buttonText: 'Soo xaree Fayl',
    validate: () => null,
  };
};
