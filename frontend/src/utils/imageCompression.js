export const compressImageFile = (file, { maxDimension = 1280, quality = 0.82 } = {}) => (
  new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Fadlan dooro sawir sax ah.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Sawirka lama akhrin karin.'));
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = () => reject(new Error('Sawirka lama furi karin.'));
      image.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  })
);
