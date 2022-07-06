export { };
declare global {
  namespace Vi {

    interface JestAssertion {
      toEqualElseLog (a: any, msg: string): R;
    }
  }
}