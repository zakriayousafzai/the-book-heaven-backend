// Copy only the explicitly allowed keys from an untrusted request body.
export const pick = (source = {}, keys = []) =>
  keys.reduce((result, key) => {
    if (source[key] !== undefined) {
      result[key] = source[key];
    }
    return result;
  }, {});
