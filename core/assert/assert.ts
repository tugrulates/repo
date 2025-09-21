import { assertEquals, assertExists, assertObjectMatch } from "@std/assert";

/** Type of an object key. */
declare type PropertyKey = string | number | symbol;
export type { PropertyKey };

/**
 * Asserts that two arrays of objects match in structure and values for the keys
 * present in the expected objects.
 *
 * This function checks that both arrays have the same length and that each
 * object in the `actual` array contains at least the same keys and corresponding
 * values as the object at the same index in the `expected` array. Extra keys in
 * the `actual` objects are ignored.
 *
 * If there is a mismatch, an assertion error is thrown with an optional custom
 * message.
 *
 * @example
 * ```ts
 * import { assertArrayObjectMatch } from "@roka/assert";
 *
 * const actual = [
 *   { id: 1, name: "Alice", age: 30 },
 *   { id: 2, name: "Bob", age: 25, extra: "data" },
 * ];
 * const expected = [
 *   { id: 1, name: "Alice" },
 *   { id: 2, name: "Bob" },
 * ];
 *
 * assertArrayObjectMatch(actual, expected);
 * ```
 *
 * @throws {AssertionError} If the arrays differ in length or if any object in
 * the `actual` array does not match the corresponding object in the `expected`
 * array.
 */
export function assertArrayObjectMatch(
  // deno-lint-ignore no-explicit-any
  actual: Record<PropertyKey, any>[],
  expected: Record<PropertyKey, unknown>[],
  message?: string,
): void {
  assertEquals(
    actual.length,
    expected.length,
    message ? `${message} different lengths` : "different lengths",
  );
  for (let i = 0; i < expected.length; i++) {
    const actualItem = actual[i];
    const expectedItem = expected[i];
    assertExists(actualItem);
    assertExists(expectedItem);
    assertObjectMatch(actualItem, expectedItem, message);
  }
}
