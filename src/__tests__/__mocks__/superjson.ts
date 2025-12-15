/**
 * Mock SuperJSON for Tests
 *
 * Provides a simplified superjson implementation for Jest tests.
 * Prevents ES module issues with the real superjson package.
 */

const superjson = {
  serialize: (obj: any) => ({ json: obj, meta: undefined }),
  deserialize: (payload: any) => payload.json || payload,
  stringify: (obj: any) => JSON.stringify(obj),
  parse: (str: string) => JSON.parse(str),
  registerClass: () => {},
  registerSymbol: () => {},
  registerCustom: () => {},
  allowErrorProps: () => {},
};

export default superjson;
