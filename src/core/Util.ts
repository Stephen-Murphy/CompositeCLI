
export const err = (namespace: string) => (err: string) => new Error(`${namespace} - ${err}`);
