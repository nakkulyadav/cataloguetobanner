export const getValidImage = (url: string | undefined | null, fallback: string = ''): string => {
    if (!url || url.includes('noImage.png')) return fallback;
    return url;
};

export const preloadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!url) {
            resolve('');
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Important for html-to-image
        img.onload = () => resolve(url);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
    });
};
